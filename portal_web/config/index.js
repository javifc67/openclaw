const path = require('path');
const os = require('os');

module.exports = {
  PORT: process.env.PORT || 3000,
  FRAMEWORK_PATH: path.join(os.homedir(), 'Escritorio/psycholinguistics_framework'),
  BASE_WORKSPACE: path.join(os.homedir(), 'Escritorio/psycho_workspace/web_users'),
  USERS_FILE: path.join(__dirname, '../users.json'),
  SYSTEM_ACCESS_KEY: 'UPM_RESEARCH_2026',
  SESSION_SECRET: 'psycholinguistics-secret-key-6366f1-4f46e5'
};
