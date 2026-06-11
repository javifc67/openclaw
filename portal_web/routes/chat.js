const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { OpenAI } = require('openai');
const config = require('../config');
const { requireAuth, getOpenClawConfig, ensureOpenClawSessionRegistered, formatReplyWithMedia } = require('../utils/helpers');
const { deduplicateUserSessionFile } = require('../utils/deduplicator');

const router = express.Router();

// Configure Multer for chat uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// Conversational Chat with the Psycho-Agent via OpenClaw Bridge
router.post('/chat', requireAuth, async (req, res) => {
  const { messages } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Falta el historial de mensajes o formato incorrecto.' });
  }

  try {
    const clawConfig = getOpenClawConfig();
    if (!clawConfig.token) {
      return res.status(500).json({ error: 'No se encontró el token de acceso en la configuración de OpenClaw.' });
    }

    const openai = new OpenAI({
      apiKey: clawConfig.token,
      baseURL: `http://127.0.0.1:${clawConfig.port}/v1`
    });
    
    // Send only last 15 messages to keep token usage low and fast
    const recentMessages = messages.slice(-15);

    const sessionUser = req.session.user.username;
    const sessionLanguage = req.session.user.language || 'es';
    ensureOpenClawSessionRegistered(sessionUser);

    const sessionKey = `agent:psycho-agent:webchat-user:${sessionUser}`;

    const systemPrompt = sessionLanguage === 'en'
      ? { role: 'system', content: 'IMPORTANT: The user has selected English as their preferred language. You MUST always speak, reply, explain everything, and interact in English.' }
      : { role: 'system', content: 'IMPORTANT: El usuario ha seleccionado Español como su idioma preferido. Debes hablar, responder, explicar todo y interactuar siempre en Español.' };

    const messagesWithInstruction = [systemPrompt, ...recentMessages];

    const completion = await openai.chat.completions.create({
      model: 'openclaw/psycho-agent',
      messages: messagesWithInstruction,
      temperature: 0.5
    }, {
      headers: {
        'x-openclaw-session-key': sessionKey
      }
    });

    const reply = completion.choices[0].message.content;

    // Parse any MEDIA:<path> tags in the agent's reply and format them into download links
    const formattedReply = formatReplyWithMedia(reply);

    // Save conversational history to user's sandboxed directory for admin visibility/audit
    try {
      const userDir = path.join(config.BASE_WORKSPACE, sessionUser);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const historyPath = path.join(userDir, 'chat_history.json');
      const fullHistory = [...messages, { role: 'assistant', content: reply }];
      fs.writeFileSync(historyPath, JSON.stringify(fullHistory, null, 2), 'utf-8');
    } catch (logErr) {
      console.error('Error logging chat history to file:', logErr);
    }

    // Deduplicate the session file on disk to prevent future alignment issues!
    deduplicateUserSessionFile(sessionUser);

    res.json({ reply: formattedReply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Error al consultar al agente en OpenClaw: ' + err.message });
  }
});

// Endpoint to fetch the session's conversational history from OpenClaw
router.get('/chat-history', requireAuth, async (req, res) => {
  try {
    const clawConfig = getOpenClawConfig();
    if (!clawConfig.token) {
      return res.status(500).json({ error: 'No se encontró el token de acceso en la configuración de OpenClaw.' });
    }

    const sessionUser = req.session.user.username;
    
    // Deduplicate on disk before loading history!
    deduplicateUserSessionFile(sessionUser);

    const sessionKey = `agent:psycho-agent:webchat-user:${sessionUser}`;

    const fetchUrl = `http://127.0.0.1:${clawConfig.port}/sessions/${sessionKey}/history`;
    
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clawConfig.token}`
      }
    });

    if (!response.ok) {
      // If the session history doesn't exist yet, return empty list
      if (response.status === 404) {
        return res.json({ history: [] });
      }
      throw new Error(`OpenClaw returned status ${response.status}`);
    }

    const data = await response.json();
    const rawItems = data.items || data.messages || [];
    
    const parsedHistory = [];
    for (const item of rawItems) {
      if (item.role !== 'user' && item.role !== 'assistant') {
        continue; // Skip systems, tool results, and other internal roles
      }

      let text = '';
      if (Array.isArray(item.content)) {
        text = item.content
          .filter(part => part.type === 'text')
          .map(part => part.text)
          .join('\n');
      } else if (typeof item.content === 'string') {
        text = item.content;
      }

      // Clean up internal thinking tags if any
      text = text.replace(/<think>[\s\S]*?<\/think>/g, '');

      // Skip cron system prompts from the chat history UI
      if (item.role === 'user' && text.includes('cron_check_experiment.py')) {
        continue;
      }

      // Clean prompt context wrappers
      if (item.role === 'user' && text.includes('[Current message - respond to this]')) {
        const parts = text.split('[Current message - respond to this]');
        let mainPart = parts[parts.length - 1].trim();
        if (mainPart.startsWith('User:')) {
          mainPart = mainPart.slice(5).trim();
        }
        text = mainPart;
      }

      const trimmedText = text.trim();
      if (!trimmedText) {
        continue; // Skip empty messages (e.g. purely tool call blocks with no conversational response)
      }

      // Format physical media paths into HTML cards
      const formattedText = formatReplyWithMedia(trimmedText);

      parsedHistory.push({
        role: item.role,
        content: formattedText
      });
    }

    res.json({ history: parsedHistory });
  } catch (err) {
    console.error('Error fetching chat history:', err);
    res.status(500).json({ error: 'Error al cargar el historial: ' + err.message });
  }
});

// Endpoint to reset/clear the chat history on OpenClaw for the logged-in user
router.post('/clear-chat', requireAuth, async (req, res) => {
  try {
    const sessionUser = req.session.user.username;
    const sessionKey = `agent:psycho-agent:webchat-user:${sessionUser}`;
    const sessionsPath = path.join(os.homedir(), '.openclaw/agents/psycho-agent/sessions/sessions.json');
    const sessionsDir = path.join(os.homedir(), '.openclaw/agents/psycho-agent/sessions');

    if (fs.existsSync(sessionsPath)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
      
      if (sessions[sessionKey]) {
        const entry = sessions[sessionKey];
        const sessionId = entry.sessionId;
        const sessionFile = entry.sessionFile || `${sessionId}.jsonl`;

        // 1. Delete associated files on disk if they exist
        const filePaths = [
          path.join(sessionsDir, sessionFile),
          path.join(sessionsDir, `${sessionId}.trajectory.jsonl`),
          path.join(sessionsDir, `${sessionId}.trajectory-path.json`),
          path.join(sessionsDir, `${sessionFile}.lock`) // Clean any stale locks too!
        ];

        for (const fp of filePaths) {
          try {
            if (fs.existsSync(fp)) {
              fs.unlinkSync(fp);
            }
          } catch (e) {
            console.error(`Error deleting file ${fp}:`, e);
          }
        }

        // 2. Remove from sessions.json database
        delete sessions[sessionKey];
        fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf-8');
        console.log(`[Session Reset] Successfully deleted files and unregistered session key: ${sessionKey}`);
      }
    }

    // Also clear the logged chat history file inside user's sandboxed directory if any
    try {
      const userDir = path.join(config.BASE_WORKSPACE, sessionUser);
      const historyPath = path.join(userDir, 'chat_history.json');
      if (fs.existsSync(historyPath)) {
        fs.unlinkSync(historyPath);
      }
    } catch (fsErr) {
      console.error('Error clearing local chat history file:', fsErr);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error clearing chat:', err);
    res.status(500).json({ error: 'Error al limpiar el chat: ' + err.message });
  }
});

// Endpoint to receive files uploaded directly via chat
router.post('/chat-upload', requireAuth, upload.single('chatFile'), (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const sessionUser = req.session.user.username;
    // Save to the user's private upload folder
    const userUploadsDir = path.join(config.BASE_WORKSPACE, sessionUser, 'chat_uploads');
    if (!fs.existsSync(userUploadsDir)) {
      fs.mkdirSync(userUploadsDir, { recursive: true });
    }

    const targetPath = path.join(userUploadsDir, file.originalname);
    fs.renameSync(file.path, targetPath);

    res.json({ 
      success: true, 
      fileName: file.originalname,
      filePath: targetPath
    });
  } catch (err) {
    console.error('Chat upload error:', err);
    res.status(500).json({ error: 'Error al subir el archivo: ' + err.message });
  }
});

module.exports = router;
