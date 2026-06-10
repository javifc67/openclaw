const express = require('express');
const session = require('express-session');
const path = require('path');
const config = require('./config');
const { readUsers } = require('./utils/helpers');

// Initialize Express App
const app = express();

// Initialize users.json default database file
readUsers();

// Middleware configuration
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Session configuration
app.use(session({
  secret: config.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if running over https behind cloudflare if needed, but false works in general tunnel environments
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Serve static public folder
app.use(express.static(path.join(__dirname, 'public')));

// Import Routes
const authRouter = require('./routes/auth');
const chatRouter = require('./routes/chat');
const experimentRouter = require('./routes/experiment');

// Register Routes
app.use('/api/auth', authRouter);
app.use('/api', chatRouter);
app.use('/api', experimentRouter);

// Start Server
app.listen(config.PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Portal de Evaluación Psicolingüística Activo`);
  console.log(`🔗 Accede localmente en: http://localhost:${config.PORT}`);
  console.log(`==================================================`);
});
