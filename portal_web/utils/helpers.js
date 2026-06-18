const fs = require('fs');
const path = require('path');
const os = require('os');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const config = require('../config');

// Helper to read and write users
function readUsers() {
  if (!fs.existsSync(config.USERS_FILE)) {
    // Default javi user with password "javi2026"
    const defaultUsers = [{
      username: 'javi',
      passwordHash: bcrypt.hashSync('javi2026', 10),
      isAdmin: true
    }];
    fs.writeFileSync(config.USERS_FILE, JSON.stringify(defaultUsers, null, 2), 'utf-8');
    return defaultUsers;
  }
  try {
    const raw = fs.readFileSync(config.USERS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading users file, resetting:', err);
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(config.USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// Middleware to check authentication
function requireAuth(req, res, next) {
  if (req.session && req.session.user) {
    next();
  } else {
    res.status(401).json({ error: 'No autorizado. Por favor inicia sesión.' });
  }
}

// Get OpenClaw configuration
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

// Ensure Webchat user is registered in psycho-agent sessions DB
function ensureOpenClawSessionRegistered(username) {
  const userOpenClawDir = path.join(config.BASE_WORKSPACE, username, '.openclaw');
  const sessionsDir = path.join(userOpenClawDir, 'agents/psycho-agent/sessions');
  const sessionsPath = path.join(sessionsDir, 'sessions.json');

  if (!fs.existsSync(sessionsDir)) {
    fs.mkdirSync(sessionsDir, { recursive: true });
  }

  let sessions = {};
  if (fs.existsSync(sessionsPath)) {
    try {
      const raw = fs.readFileSync(sessionsPath, 'utf-8');
      sessions = JSON.parse(raw);
    } catch (err) {
      console.error('Error parsing sessions.json, resetting:', err);
    }
  }

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
}

// Parse and replace MEDIA:<path> tags with beautiful download cards HTML
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

module.exports = {
  readUsers,
  writeUsers,
  requireAuth,
  getOpenClawConfig,
  ensureOpenClawSessionRegistered,
  formatReplyWithMedia
};
