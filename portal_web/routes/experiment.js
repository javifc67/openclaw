const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const config = require('../config');
const { requireAuth } = require('../utils/helpers');
const { activeRuns, runPipelineAsync } = require('../services/pipelineService');

const router = express.Router();

// Configure Multer for file uploads
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

// HTTP endpoint to receive form data and start the experiment
router.post('/start-experiment', requireAuth, upload.single('wordsFile'), (req, res) => {
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
    const userDir = path.join(config.BASE_WORKSPACE, sessionUser);
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
    const sourceEnv = path.join(config.FRAMEWORK_PATH, 'apis_example.env');
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
router.get('/stream-logs/:runId', requireAuth, (req, res) => {
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
router.get('/download/:runId', requireAuth, (req, res) => {
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

// Endpoint to download files returned by the agent
router.get('/download-result', requireAuth, (req, res) => {
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

  // Resolve relative paths to absolute paths before security check and file access
  const absolutePath = path.resolve(filePath);
  console.log(`[Download Result] Resolved absolute filePath: ${absolutePath}`);

  // Security: Only allow downloading files within the authorized workspaces
  const isInsideWorkspace = absolutePath.startsWith(path.dirname(config.BASE_WORKSPACE)) || 
                            absolutePath.startsWith(path.join(os.homedir(), '.openclaw/workspace'));
  
  console.log(`[Download Result] isInsideWorkspace check: ${isInsideWorkspace}`);
  if (!isInsideWorkspace) {
    console.warn(`[Download Result] Security block: filePath is not inside authorized workspaces.`);
    return res.status(403).send('No tienes permisos para descargar este archivo.');
  }

  const fileExists = fs.existsSync(absolutePath);
  console.log(`[Download Result] File exists check: ${fileExists}`);
  if (!fileExists) {
    console.warn(`[Download Result] File not found on disk: ${absolutePath}`);
    return res.status(404).send('El archivo solicitado no existe.');
  }

  console.log(`[Download Result] Initiating res.download for: ${absolutePath}`);
  res.download(absolutePath, (err) => {
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

module.exports = router;
