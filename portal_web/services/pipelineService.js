const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const config = require('../config');

// Store active run logs in memory
const activeRuns = new Map();

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
      [path.join(config.FRAMEWORK_PATH, 'prepare_experiment.py'), run.expDir, 'original'],
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
      [path.join(config.FRAMEWORK_PATH, 'execute_experiment.py'), run.expDir, 'original'],
      run.expDir,
      (data) => {
        logToClients('execute', data);
        writeThoughtLog([`[Execute Log] ${data}`]);
      }
    );

    // 3. Run generateResults.py
    logToClients('compile', `Compilando resultados con generateResults.py en modo ${run.mode}...`);
    writeThoughtLog([`\nPaso 5: Iniciando generateResults.py con modo: ${run.mode}...`]);
    
    const compileArgs = [path.join(config.FRAMEWORK_PATH, 'generateResults.py'), run.expDir, run.mode];
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

module.exports = {
  activeRuns,
  runPipelineAsync,
  executeScript
};
