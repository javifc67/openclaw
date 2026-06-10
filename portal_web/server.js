const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const bcrypt = require('bcryptjs');
const session = require('express-session');

const app = express();
const PORT = process.env.PORT || 3000;

// Path definitions
const FRAMEWORK_PATH = path.join(os.homedir(), 'Escritorio/psycholinguistics_framework');
const BASE_WORKSPACE = path.join(os.homedir(), 'Escritorio/psycho_workspace/web_users');
const USERS_FILE = path.join(__dirname, 'users.json');

// System-wide security key to authorize registration of new users
const SYSTEM_ACCESS_KEY = 'UPM_RESEARCH_2026';

// Middleware and Session configuration
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'psycholinguistics-secret-key-6366f1-4f46e5',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if running over https behind cloudflare if needed, but false works in general tunnel environments
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Serve static public folder
app.use(express.static(path.join(__dirname, 'public')));

// Helper to read and write users
function readUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    // Default javi user with password "javi2026"
    const defaultUsers = [{
      username: 'javi',
      passwordHash: bcrypt.hashSync('javi2026', 10),
      isAdmin: true
    }];
    fs.writeFileSync(USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf-8');
    return defaultUsers;
  }
  try {
    const raw = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading users file, resetting:', err);
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// Ensure database file is initialized
readUsers();

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
  }
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(__dirname, 'uploads');
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

// Store active run logs in memory
const activeRuns = new Map();

// --- Auth Endpoints ---

// Check session state
app.get('/api/auth/session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, username: req.session.user.username, language: req.session.user.language || 'es' });
  } else {
    res.json({ loggedIn: false });
  }
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Falta usuario o contraseña.' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  const users = readUsers();
  const user = users.find(u => u.username === normalizedUsername);

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
  }

  // Set session
  req.session.user = {
    username: user.username,
    isAdmin: !!user.isAdmin,
    language: user.language || 'es'
  };

  res.json({ success: true, username: user.username, language: req.session.user.language });
});

// Register User
app.post('/api/auth/register', (req, res) => {
  const { username, password, systemKey, language } = req.body;
  if (!username || !password || !systemKey) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el registro.' });
  }

  if (systemKey !== SYSTEM_ACCESS_KEY) {
    return res.status(403).json({ error: 'Clave de sistema incorrecta. No estás autorizado para crear cuentas.' });
  }

  const normalizedUsername = username.trim().toLowerCase();
  
  // Basic validation
  if (normalizedUsername.length < 3) {
    return res.status(400).json({ error: 'El nombre de usuario debe tener al menos 3 caracteres.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
  }
  if (!/^[a-z0-9_]+$/.test(normalizedUsername)) {
    return res.status(400).json({ error: 'El usuario solo puede contener letras, números y guiones bajos.' });
  }

  const users = readUsers();
  if (users.some(u => u.username === normalizedUsername)) {
    return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
  }

  const newUser = {
    username: normalizedUsername,
    passwordHash: bcrypt.hashSync(password, 10),
    isAdmin: false,
    language: language === 'en' ? 'en' : 'es'
  };

  users.push(newUser);
  writeUsers(users);

  // Auto-login after registration
  req.session.user = {
    username: newUser.username,
    isAdmin: false,
    language: newUser.language
  };

  res.json({ success: true, username: newUser.username, language: newUser.language });
});

// Logout User
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión.' });
    }
    res.json({ success: true });
  });
});

// Update user language preference
app.post('/api/auth/update-language', requireAuth, (req, res) => {
  const { language } = req.body;
  if (!language || (language !== 'es' && language !== 'en')) {
    return res.status(400).json({ error: 'Idioma no válido.' });
  }

  const username = req.session.user.username;
  const users = readUsers();
  const user = users.find(u => u.username === username);

  if (user) {
    user.language = language;
    writeUsers(users);
    req.session.user.language = language;
    res.json({ success: true, language });
  } else {
    res.status(404).json({ error: 'Usuario no encontrado.' });
  }
});

// --- Chat Endpoint (Require Authentication) ---

const { OpenAI } = require('openai');

function getOpenClawConfig() {
  const configPath = path.join(os.homedir(), '.openclaw/openclaw.json');
  if (fs.existsSync(configPath)) {
    try {
      const raw = fs.readFileSync(configPath, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        port: parsed.gateway?.port || 18789,
        token: parsed.gateway?.auth?.token || null
      };
    } catch (err) {
      console.error('Error parsing OpenClaw config:', err);
    }
  }
  return { port: 18789, token: null };
}

const crypto = require('crypto');

function ensureOpenClawSessionRegistered(username) {
  const sessionsPath = path.join(os.homedir(), '.openclaw/agents/psycho-agent/sessions/sessions.json');
  if (!fs.existsSync(sessionsPath)) return;

  try {
    const raw = fs.readFileSync(sessionsPath, 'utf-8');
    const sessions = JSON.parse(raw);
    const sessionKey = `agent:psycho-agent:webchat-user:${username}`;

    if (!sessions[sessionKey]) {
      const now = Date.now();
      const displayName = `${username.charAt(0).toUpperCase() + username.slice(1)} WEB`;
      sessions[sessionKey] = {
        sessionId: crypto.randomUUID(),
        updatedAt: now,
        sessionStartedAt: now,
        lastInteractionAt: now,
        displayName: displayName,
        subject: displayName,
        chatType: 'direct'
      };
      fs.writeFileSync(sessionsPath, JSON.stringify(sessions, null, 2), 'utf-8');
      console.log(`[OpenClaw Registration] Registered new session key for ${username}: ${sessionKey}`);
    }
  } catch (err) {
    console.error('Error ensuring OpenClaw session is registered:', err);
  }
}

// Helper to parse and replace any MEDIA:<path> tags with beautiful download cards
function formatReplyWithMedia(text) {
  if (!text) return '';
  let formatted = text;
  const mediaRegex = /MEDIA:([^\s\n\r\t]+)/g;
  const matches = [...text.matchAll(mediaRegex)];
  for (const m of matches) {
    const fullMatch = m[0];
    const filePath = m[1];
    const fileName = path.basename(filePath);
    const downloadHtml = `<div class="download-card">
      <span class="file-icon">📦</span>
      <div class="file-details">
        <span class="file-name">${fileName}</span>
        <span class="file-action">Listo para descargar</span>
      </div>
      <a href="/api/download-result?path=${encodeURIComponent(filePath)}" class="download-btn-link" download>Descargar 📥</a>
    </div>`;
    formatted = formatted.replace(fullMatch, downloadHtml);
  }
  return formatted;
}

// Helper to clean text for duplicate comparison
function cleanTextForComparison(text) {
  if (!text) return '';
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, '')
    .replace(/<final>/g, '')
    .replace(/<\/final>/g, '')
    .trim();
}

// Raw JSONL file deduplicator
function deduplicateJsonl(filePath) {
  try {
    if (!fs.existsSync(filePath)) return;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const cleanLines = [];
    let lastMessageRole = null;
    let lastMessageText = null;

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const obj = JSON.parse(line);
        if (obj.type === 'message' && obj.message) {
          const role = obj.message.role;
          let text = '';
          if (Array.isArray(obj.message.content)) {
            text = obj.message.content
              .filter(part => part.type === 'text')
              .map(part => part.text)
              .join('\n');
          } else if (typeof obj.message.content === 'string') {
            text = obj.message.content;
          }

          const currentCleanText = cleanTextForComparison(text);

          // Check if this is a consecutive duplicate (same role and content)
          if (role === 'assistant' && lastMessageRole === 'assistant' && currentCleanText === lastMessageText) {
            console.log(`[Deduplicator] Discarded duplicate assistant message line: ${obj.id}`);
            continue; // Skip writing this line!
          }

          lastMessageRole = role;
          lastMessageText = currentCleanText;
        }
        cleanLines.push(line);
      } catch (err) {
        cleanLines.push(line);
      }
    }

    fs.writeFileSync(filePath, cleanLines.join('\n') + '\n', 'utf-8');
  } catch (err) {
    console.error('Error in deduplicateJsonl:', err);
  }
}

// Find and deduplicate the user's OpenClaw JSONL session file on disk
function deduplicateUserSessionFile(username) {
  try {
    const sessionKey = `agent:psycho-agent:webchat-user:${username}`;
    const sessionsPath = path.join(os.homedir(), '.openclaw/agents/psycho-agent/sessions/sessions.json');
    const sessionsDir = path.join(os.homedir(), '.openclaw/agents/psycho-agent/sessions');

    if (fs.existsSync(sessionsPath)) {
      const sessions = JSON.parse(fs.readFileSync(sessionsPath, 'utf-8'));
      if (sessions[sessionKey]) {
        const entry = sessions[sessionKey];
        const sessionId = entry.sessionId;
        const sessionFile = entry.sessionFile ? path.basename(entry.sessionFile) : `${sessionId}.jsonl`;
        const filePath = path.join(sessionsDir, sessionFile);
        deduplicateJsonl(filePath);
      }
    }
  } catch (err) {
    console.error('Error deduplicating user session file:', err);
  }
}

// Conversational Chat with the Psycho-Agent via OpenClaw Bridge
app.post('/api/chat', requireAuth, async (req, res) => {
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
      const sessionUser = req.session.user.username;
      const userDir = path.join(BASE_WORKSPACE, sessionUser);
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
app.get('/api/chat-history', requireAuth, async (req, res) => {
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
app.post('/api/clear-chat', requireAuth, async (req, res) => {
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
      const userDir = path.join(BASE_WORKSPACE, sessionUser);
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


// --- Experiment Endpoints (Require Authentication) ---

// HTTP endpoint to receive form data and start the experiment
app.post('/api/start-experiment', requireAuth, upload.single('wordsFile'), (req, res) => {
  try {
    const { prompt, model, column, mode, language } = req.body;
    const file = req.file;
    const sessionUser = req.session.user.username; // Use verified session username

    if (!file) {
      return res.status(400).json({ error: 'Falta el archivo Excel/CSV con las palabras.' });
    }
    if (!prompt) {
      return res.status(400).json({ error: 'El prompt de evaluación no puede estar vacío.' });
    }
    if (!model) {
      return res.status(400).json({ error: 'Debes seleccionar un modelo.' });
    }
    if (!column) {
      return res.status(400).json({ error: 'Debes especificar el nombre de la columna.' });
    }

    const runId = `exp-${Date.now()}`;
    // Sandbox specific to the logged-in user!
    const userDir = path.join(BASE_WORKSPACE, sessionUser);
    const expDir = path.join(userDir, runId);
    fs.mkdirSync(expDir, { recursive: true });

    // Create the 'data' folder required by the framework scripts!
    const dataDir = path.join(expDir, 'data');
    fs.mkdirSync(dataDir, { recursive: true });

    // Move uploaded file to the experiment data directory
    const fileExt = path.extname(file.originalname);
    const destinationFileName = `words${fileExt}`;
    const destinationPath = path.join(dataDir, destinationFileName);
    fs.renameSync(file.path, destinationPath);

    // Save prompt to prompt.txt
    const promptPath = path.join(expDir, 'prompt.txt');
    fs.writeFileSync(promptPath, prompt, 'utf-8');

    // Deduce company based on model
    let company = 'OpenAI';
    if (model.toLowerCase().includes('gemini') || model.toLowerCase().includes('google')) {
      company = 'Google';
    } else if (model.toLowerCase().includes('llama') || model.toLowerCase().includes('local')) {
      company = 'Local';
    }

    // Build config.yaml
    const configYamlContent = `experiments:
  original:
    dataset_path: "${destinationFileName}"
    dataset_column: "${column}"
    prompt_path: "prompt.txt"
    model_name: "${model}"
    company: "${company}"
`;
    fs.writeFileSync(path.join(expDir, 'config.yaml'), configYamlContent, 'utf-8');

    // Copy apis_example.env to apis.env in the experiment dir
    const sourceEnv = path.join(FRAMEWORK_PATH, 'apis_example.env');
    const destEnv = path.join(expDir, 'apis.env');
    if (fs.existsSync(sourceEnv)) {
      fs.copyFileSync(sourceEnv, destEnv);
    } else {
      fs.writeFileSync(destEnv, '# Empty env', 'utf-8');
    }

    // Initialize state for the live run
    activeRuns.set(runId, {
      id: runId,
      username: sessionUser, // Link to user
      status: 'pending',
      expDir,
      mode: mode || 'weighted_sum',
      language: language || '',
      logs: [],
      clients: []
    });

    // Start background execution asynchronously
    runPipelineAsync(runId);

    res.json({ runId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al inicializar el experimento: ' + err.message });
  }
});

// SSE endpoint for streaming logs to the frontend
app.get('/api/stream-logs/:runId', requireAuth, (req, res) => {
  const runId = req.params.runId;
  const run = activeRuns.get(runId);
  const sessionUser = req.session.user.username;

  if (!run) {
    res.status(404).send('No se encontró el experimento.');
    return;
  }

  // Security: Ensure users can only listen to their own experiment logs
  if (run.username !== sessionUser) {
    res.status(403).send('No tienes permisos para ver este experimento.');
    return;
  }

  // Set headers for Server-Sent Events
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(':\n\n');
  }, 10000);

  // Send existing logs
  run.logs.forEach(log => {
    res.write(`data: ${JSON.stringify(log)}\n\n`);
  });

  // Subscribe client
  run.clients.push(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    run.clients = run.clients.filter(c => c !== res);
  });
});

// Endpoint to download the final ZIP file
app.get('/api/download/:runId', requireAuth, (req, res) => {
  const runId = req.params.runId;
  const run = activeRuns.get(runId);
  const sessionUser = req.session.user.username;

  if (!run || run.status !== 'completed') {
    return res.status(404).send('El archivo ZIP aún no está disponible o el experimento falló.');
  }

  // Security: Ensure users can only download their own experiment results
  if (run.username !== sessionUser) {
    return res.status(403).send('No tienes permisos para descargar este archivo.');
  }

  const zipPath = path.join(run.expDir, 'experimento.zip');
  if (!fs.existsSync(zipPath)) {
    return res.status(404).send('No se encontró el archivo ZIP en el disco.');
  }

  res.download(zipPath, `resultado-${runId}.zip`);
});

// Endpoint to receive files uploaded directly via chat
app.post('/api/chat-upload', requireAuth, upload.single('chatFile'), (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: 'No se recibió ningún archivo.' });
    }

    const sessionUser = req.session.user.username;
    // Save to the user's private upload folder
    const userUploadsDir = path.join(BASE_WORKSPACE, sessionUser, 'chat_uploads');
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

// Endpoint to download files returned by the agent
app.get('/api/download-result', requireAuth, (req, res) => {
  let filePath = req.query.path;
  console.log(`[Download Result] Download request received from user: ${req.session.user ? req.session.user.username : 'undefined'}`);
  console.log(`[Download Result] Requested raw filePath: ${filePath}`);
  
  if (filePath) {
    // Sanitize any italic HTML tags inserted by frontend markdown parsing of underscores
    filePath = filePath.replace(/<em>/g, '_').replace(/<\/em>/g, '_');
    console.log(`[Download Result] Sanitized filePath: ${filePath}`);
  }
  
  if (!filePath) {
    console.warn(`[Download Result] Missing filePath parameter.`);
    return res.status(400).send('Falta la ruta del archivo.');
  }

  // Security: Only allow downloading files within the authorized workspaces
  const isInsideWorkspace = filePath.startsWith(path.join(os.homedir(), 'Escritorio/psycho_workspace')) || 
                            filePath.startsWith(path.join(os.homedir(), '.openclaw/workspace'));
  
  console.log(`[Download Result] isInsideWorkspace check: ${isInsideWorkspace}`);
  if (!isInsideWorkspace) {
    console.warn(`[Download Result] Security block: filePath is not inside authorized workspaces.`);
    return res.status(403).send('No tienes permisos para descargar este archivo.');
  }

  const fileExists = fs.existsSync(filePath);
  console.log(`[Download Result] File exists check: ${fileExists}`);
  if (!fileExists) {
    console.warn(`[Download Result] File not found on disk: ${filePath}`);
    return res.status(404).send('El archivo solicitado no existe.');
  }

  console.log(`[Download Result] Initiating res.download for: ${filePath}`);
  res.download(filePath, (err) => {
    if (err) {
      console.error(`[Download Result] Error during res.download:`, err);
      if (!res.headersSent) {
        res.status(500).send('Error al descargar el archivo: ' + err.message);
      }
    } else {
      console.log(`[Download Result] Successfully downloaded: ${filePath}`);
    }
  });
});

// Async pipeline runner
async function runPipelineAsync(runId) {
  const run = activeRuns.get(runId);
  if (!run) return;

  const logToClients = (status, text) => {
    const payload = { status, text, timestamp: Date.now() };
    run.logs.push(payload);
    run.status = status;
    run.clients.forEach(res => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
  };

  const writeThoughtLog = (logLines) => {
    const thoughtPath = path.join(run.expDir, 'pensamiento_log.txt');
    fs.appendFileSync(thoughtPath, logLines.join('\n') + '\n', 'utf-8');
  };

  try {
    logToClients('preparing', 'Inicializando bitácora de pensamiento (pensamiento_log.txt)...');
    writeThoughtLog([
      '=== BITÁCORA DE PROCESO DE PENSAMIENTO ===',
      `Fecha/Hora: ${new Date().toISOString()}`,
      `ID del Experimento: ${runId}`,
      `Usuario Ejecutor: ${run.username}`,
      `Carpeta de Trabajo: ${run.expDir}`,
      'Paso 1: Archivos de configuración y datos validados con éxito.',
      'Paso 2: Copiado de claves globales y variables de entorno completado.'
    ]);

    // 1. Run prepare_experiment.py
    logToClients('prepare', 'Ejecutando prepare_experiment.py para generar los JSONL batches...');
    writeThoughtLog(['\nPaso 3: Iniciando prepare_experiment.py...']);
    
    await executeScript(
      'python3',
      [path.join(FRAMEWORK_PATH, 'prepare_experiment.py'), run.expDir, 'original'],
      run.expDir,
      (data) => {
        logToClients('prepare', data);
        writeThoughtLog([`[Prepare Log] ${data}`]);
      }
    );

    // 2. Run execute_experiment.py
    logToClients('execute', 'Ejecutando execute_experiment.py para consultar la API y obtener respuestas...');
    writeThoughtLog(['\nPaso 4: Iniciando execute_experiment.py (Esto puede tomar tiempo si hay muchas palabras)...']);
    
    await executeScript(
      'python3',
      [path.join(FRAMEWORK_PATH, 'execute_experiment.py'), run.expDir, 'original'],
      run.expDir,
      (data) => {
        logToClients('execute', data);
        writeThoughtLog([`[Execute Log] ${data}`]);
      }
    );

    // 3. Run generateResults.py
    logToClients('compile', `Compilando resultados con generateResults.py en modo ${run.mode}...`);
    writeThoughtLog([`\nPaso 5: Iniciando generateResults.py con modo: ${run.mode}...`]);
    
    const compileArgs = [path.join(FRAMEWORK_PATH, 'generateResults.py'), run.expDir, run.mode];
    if (run.language) {
      compileArgs.push(run.language);
    }

    await executeScript(
      'python3',
      compileArgs,
      run.expDir,
      (data) => {
        logToClients('compile', data);
        writeThoughtLog([`[Compile Log] ${data}`]);
      }
    );

    // 4. Cleanup apis.env
    logToClients('cleanup', 'Limpiando archivos temporales y protegiendo claves del servidor...');
    writeThoughtLog(['\nPaso 6: Borrando el archivo temporal de claves apis.env para protección del servidor.']);
    
    const envPath = path.join(run.expDir, 'apis.env');
    if (fs.existsSync(envPath)) {
      fs.unlinkSync(envPath);
    }

    // 5. Compress directory to .zip
    logToClients('compress', 'Empaquetando toda la carpeta del experimento en experimento.zip...');
    writeThoughtLog(['\nPaso 7: Comprimiendo el espacio de trabajo en archivo ZIP final...']);
    
    await executeScript(
      'zip',
      ['-r', 'experimento.zip', '.'],
      run.expDir,
      (data) => {
        logToClients('compress', data);
      }
    );

    logToClients('completed', '¡Experimento completado con éxito! El archivo final está listo para descargar.');
    writeThoughtLog([
      '\nPaso 8: Compresión completada.',
      '=== FIN DE LA BITÁCORA DE PROCESAMIENTO ===',
      `El proceso ha culminado exitosamente el ${new Date().toISOString()}`
    ]);

    // Close all SSE clients for this run
    run.clients.forEach(res => {
      res.write(`data: ${JSON.stringify({ status: 'completed', text: 'DONE' })}\n\n`);
      res.end();
    });

  } catch (error) {
    console.error(error);
    logToClients('failed', `Error en la ejecución del pipeline: ${error.message}`);
    writeThoughtLog([
      `\n⚠️ ERROR DETECTADO: ${error.message}`,
      'El procesamiento fue abortado.'
    ]);
    
    // Attempt cleanup of apis.env even if failed
    const envPath = path.join(run.expDir, 'apis.env');
    if (fs.existsSync(envPath)) {
      try { fs.unlinkSync(envPath); } catch (_) {}
    }

    run.clients.forEach(res => {
      res.write(`data: ${JSON.stringify({ status: 'failed', text: error.message })}\n\n`);
      res.end();
    });
  }
}

// Promise wrapper around spawn
function executeScript(cmd, args, cwd, onData) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, env: { ...process.env } });

    proc.stdout.on('data', (data) => {
      const text = data.toString().trim();
      if (text) onData(text);
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString().trim();
      if (text) onData(`[ERR] ${text}`);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`El comando "${cmd} ${args.join(' ')}" falló con código de salida ${code}`));
      }
    });
  });
}

// Start Server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Portal de Evaluación Psicolingüística Activo`);
  console.log(`🔗 Accede localmente en: http://localhost:${PORT}`);
  console.log(`==================================================`);
});