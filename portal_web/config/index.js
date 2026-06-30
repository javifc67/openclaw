const path = require('path');
const os = require('os');
const fs = require('fs');

const home = os.homedir();

// Dynamically detect system's Desktop/Escritorio directory
const desktopDirName = fs.existsSync(path.join(home, 'Escritorio')) ? 'Escritorio' : 'Desktop';

// Detect or fallback framework path
let frameworkPath = process.env.FRAMEWORK_PATH || path.join(home, desktopDirName, 'psycholinguistics_framework');
if (!fs.existsSync(frameworkPath) && fs.existsSync(path.join(home, 'psycholinguistics_framework'))) {
  frameworkPath = path.join(home, 'psycholinguistics_framework');
}

// Detect or fallback workspace path
let baseWorkspace = process.env.BASE_WORKSPACE || path.join(home, desktopDirName, 'psycho_workspace/web_users');
if (!fs.existsSync(path.dirname(baseWorkspace)) && fs.existsSync(path.join(home, 'psycho_workspace'))) {
  baseWorkspace = path.join(home, 'psycho_workspace/web_users');
}

module.exports = {
  PORT: process.env.PORT || 3000,
  FRAMEWORK_PATH: frameworkPath,
  BASE_WORKSPACE: baseWorkspace,
  USERS_FILE: path.join(__dirname, '../users.json'),
  SYSTEM_ACCESS_KEY: 'UPM_RESEARCH_2026',
  SESSION_SECRET: 'psycholinguistics-secret-key-6366f1-4f46e5'
};
