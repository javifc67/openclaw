const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { readUsers, writeUsers } = require('../utils/helpers');

// Keep track of user's last interaction in memory for idle timeout shutdown
const lastUserActivity = new Map();
const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity

// Promise wrapper around shell exec
function execPromise(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        resolve({ error, stdout: stdout.trim(), stderr: stderr.trim() });
      } else {
        resolve({ error: null, stdout: stdout.trim(), stderr: stderr.trim() });
      }
    });
  });
}

/**
 * Gets or assigns a unique host port for a user.
 * Ports are assigned sequentially starting from 19001 and stored in users.json.
 */
function getOrCreateUserPort(username) {
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user) throw new Error(`Usuario ${username} no encontrado en la base de datos.`);
  
  if (user.port) {
    return user.port;
  }
  
  // Assign next available port
  const assignedPorts = users.map(u => u.port).filter(Boolean);
  const nextPort = assignedPorts.length > 0 ? Math.max(...assignedPorts) + 1 : 19001;
  
  user.port = nextPort;
  writeUsers(users);
  console.log(`[DockerService] Asignado puerto host ${nextPort} al usuario: ${username}`);
  return nextPort;
}

/**
 * Reads the secure random token generated inside the user's OpenClaw config file.
 */
function getUserOpenClawConfig(username) {
  const port = getOrCreateUserPort(username);
  const userOpenClawDir = path.join(config.BASE_WORKSPACE, username, '.openclaw');
  const openclawJsonPath = path.join(userOpenClawDir, 'openclaw.json');
  
  let token = null;
  if (fs.existsSync(openclawJsonPath)) {
    try {
      const raw = fs.readFileSync(openclawJsonPath, 'utf-8');
      const parsed = JSON.parse(raw);
      token = parsed.gateway?.auth?.token || null;
    } catch (err) {
      console.error(`[DockerService] Error leyendo openclaw.json para ${username}:`, err);
    }
  }
  
  return { port, token };
}

/**
 * Registers user activity to reset their idle timeout timer.
 */
function registerUserActivity(username) {
  lastUserActivity.set(username, Date.now());
}

/**
 * Ensures a user's OpenClaw container is built, configured, and actively running.
 */
async function startUserContainer(username) {
  const containerName = `openclaw-user-${username}`;
  const port = getOrCreateUserPort(username);
  const userOpenClawDir = path.join(config.BASE_WORKSPACE, username, '.openclaw');

  // Create workspace directory on host if it doesn't exist yet
  if (!fs.existsSync(userOpenClawDir)) {
    fs.mkdirSync(userOpenClawDir, { recursive: true });
  }

  // Update activity timestamp
  registerUserActivity(username);

  // 1. Check if container is already running
  const runningCheck = await execPromise(`docker ps --filter name=^${containerName}$ --format '{{.Names}}'`);
  if (runningCheck.stdout === containerName) {
    console.log(`[DockerService] El contenedor ${containerName} ya está en ejecución.`);
    return getUserOpenClawConfig(username);
  }

  // 2. Check if container exists but is stopped
  const existsCheck = await execPromise(`docker ps -a --filter name=^${containerName}$ --format '{{.Names}}'`);
  if (existsCheck.stdout === containerName) {
    console.log(`[DockerService] El contenedor ${containerName} existe pero está detenido. Arrancándolo...`);
    const startResult = await execPromise(`docker start ${containerName}`);
    if (startResult.error) {
      throw new Error(`Error al iniciar el contenedor existente: ${startResult.stderr}`);
    }
  } else {
    // 3. Create and start a fresh container
    console.log(`[DockerService] El contenedor ${containerName} no existe. Creando uno nuevo...`);
    
    // We map host's unique user-port to container's 18789
    // We mount the host's user-specific .openclaw folder to the container's /root/.openclaw
    const runCmd = `docker run -d --name ${containerName} -p ${port}:18789 -v ${userOpenClawDir}:/root/.openclaw openclaw-psycho-agent`;
    const runResult = await execPromise(runCmd);
    if (runResult.error) {
      throw new Error(`Error al ejecutar docker run: ${runResult.stderr}. ¿Compilaste la imagen 'openclaw-psycho-agent'?`);
    }
  }

  // 4. Wait for the OpenClaw gateway to initialize and boot up completely
  console.log(`[DockerService] Esperando a que el Gateway de OpenClaw del usuario ${username} inicie en el puerto ${port}...`);
  await waitForGateway(port);
  console.log(`[DockerService] Contenedor para ${username} listo y en línea.`);

  return getUserOpenClawConfig(username);
}

/**
 * Stops a user's OpenClaw container.
 */
async function stopUserContainer(username) {
  const containerName = `openclaw-user-${username}`;
  console.log(`[DockerService] Deteniendo contenedor ${containerName} por inactividad...`);
  
  const stopResult = await execPromise(`docker stop ${containerName}`);
  if (stopResult.error) {
    console.error(`[DockerService] Error deteniendo contenedor ${containerName}:`, stopResult.stderr);
    return false;
  }
  
  lastUserActivity.delete(username);
  console.log(`[DockerService] Contenedor ${containerName} detenido con éxito.`);
  return true;
}

/**
 * Helper to poll the gateway port until it accepts connections (up to 10 seconds)
 */
function waitForGateway(port, retries = 10, interval = 1000) {
  return new Promise((resolve, reject) => {
    let attempt = 0;
    const check = () => {
      attempt++;
      const socket = require('net').createConnection(port, '127.0.0.1');
      
      socket.on('connect', () => {
        socket.destroy();
        resolve();
      });
      
      socket.on('error', (err) => {
        socket.destroy();
        if (attempt >= retries) {
          reject(new Error(`Timeout esperando al Gateway de OpenClaw en el puerto ${port}: ${err.message}`));
        } else {
          setTimeout(check, interval);
        }
      });
    };
    setTimeout(check, 500); // Wait first half-second before polling
  });
}

/**
 * Periodically called to shut down inactive containers and free server RAM.
 */
async function checkIdleContainers() {
  const now = Date.now();
  for (const [username, lastInteraction] of lastUserActivity.entries()) {
    if (now - lastInteraction > IDLE_TIMEOUT_MS) {
      try {
        await stopUserContainer(username);
      } catch (err) {
        console.error(`[DockerService] Error en limpieza por inactividad de ${username}:`, err);
      }
    }
  }
}

// Start automatic idle cleaner interval every minute
setInterval(checkIdleContainers, 60 * 1000);

module.exports = {
  getOrCreateUserPort,
  getUserOpenClawConfig,
  registerUserActivity,
  startUserContainer,
  stopUserContainer
};
