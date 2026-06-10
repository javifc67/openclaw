const fs = require('fs');
const path = require('path');
const os = require('os');

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

module.exports = {
  cleanTextForComparison,
  deduplicateJsonl,
  deduplicateUserSessionFile
};
