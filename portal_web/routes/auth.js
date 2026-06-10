const express = require('express');
const bcrypt = require('bcryptjs');
const config = require('../config');
const { readUsers, writeUsers, requireAuth } = require('../utils/helpers');

const router = express.Router();

// Check session state
router.get('/session', (req, res) => {
  if (req.session && req.session.user) {
    res.json({ loggedIn: true, username: req.session.user.username, language: req.session.user.language || 'es' });
  } else {
    res.json({ loggedIn: false });
  }
});

// Login User
router.post('/login', (req, res) => {
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
router.post('/register', (req, res) => {
  const { username, password, systemKey, language } = req.body;
  if (!username || !password || !systemKey) {
    return res.status(400).json({ error: 'Faltan campos obligatorios para el registro.' });
  }

  if (systemKey !== config.SYSTEM_ACCESS_KEY) {
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
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Error al cerrar sesión.' });
    }
    res.json({ success: true });
  });
});

// Update user language preference
router.post('/update-language', requireAuth, (req, res) => {
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

module.exports = router;
