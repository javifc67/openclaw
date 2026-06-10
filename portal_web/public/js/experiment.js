import { state } from './state.js';
import { formatMarkdown, appendMessage, appendConsoleLine } from './utils.js';

export function initExperiment({ showAuth }) {
    const form = document.getElementById('experiment-form');
    const submitBtn = document.getElementById('submit-btn');
    const chatMessages = document.getElementById('chat-messages');
    const consoleLogs = document.getElementById('console-logs');
    const consoleDrawer = document.getElementById('console-drawer');
    const toggleConsole = document.getElementById('toggle-console');
    const systemStatus = document.getElementById('system-status');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Check if there is already an active run
        if (submitBtn.disabled) return;

        // Collect parameters
        const fileInput = document.getElementById('wordsFile');
        const column = document.getElementById('column').value.trim();
        const model = document.getElementById('model').value;
        const mode = document.getElementById('mode').value;
        const language = document.getElementById('language').value.trim();
        const prompt = document.getElementById('prompt').value.trim();

        if (!fileInput.files[0]) {
            alert('Por favor, selecciona un archivo de palabras (Excel o CSV).');
            return;
        }

        // Lock form during execution
        submitBtn.disabled = true;
        submitBtn.querySelector('span').textContent = 'Procesando... ⏳';
        systemStatus.textContent = 'Enviando petición al servidor...';

        // Add user chat bubble
        const userMsg = `
            <p><strong>He configurado un nuevo experimento privado:</strong></p>
            <ul>
                <li><strong>Archivo:</strong> <code>${fileInput.files[0].name}</code></li>
                <li><strong>Columna:</strong> <code>${column}</code></li>
                <li><strong>Modelo LLM:</strong> <code>${model}</code></li>
                <li><strong>Modo:</strong> <code>${mode}</code></li>
                ${language ? `<li><strong>Idioma:</strong> <code>${language}</code></li>` : ''}
            </ul>
        `;
        appendMessage(chatMessages, 'user', userMsg);
        state.chatHistory.push({ role: 'user', content: `He iniciado un experimento con archivo: ${fileInput.files[0].name}, columna: ${column}, modelo: ${model}, compilación: ${mode}.` });

        // Add initial agent thinking/processing bubble
        const processingBubble = appendMessage(chatMessages, 'assistant', `
            <p>He recibido los parámetros y tu archivo. Estoy aislando tu espacio de trabajo en tu directorio de usuario privado e iniciando el pipeline en el servidor...</p>
            <div class="progress-container">
                <div class="progress-bar-bg">
                    <div id="run-progress-fill" class="progress-bar-fill" style="width: 5%"></div>
                </div>
                <span id="run-progress-text" class="progress-text">Inicializando experimento...</span>
            </div>
        `);

        appendConsoleLine(consoleLogs, `\n[SISTEMA] --- INICIANDO EXPERIMENTO PRIVADO EN TU DIRECTORIO ---`, 'system');
        appendConsoleLine(consoleLogs, `[SISTEMA] Archivo: ${fileInput.files[0].name}`);
        appendConsoleLine(consoleLogs, `[SISTEMA] Columna: ${column}`);
        appendConsoleLine(consoleLogs, `[SISTEMA] Modelo: ${model}`);
        appendConsoleLine(consoleLogs, `[SISTEMA] Modo: ${mode}`);

        // Prepare Multi-part Form Data
        const formData = new FormData();
        formData.append('wordsFile', fileInput.files[0]);
        formData.append('column', column);
        formData.append('model', model);
        formData.append('mode', mode);
        formData.append('language', language);
        formData.append('prompt', prompt);

        try {
            const response = await fetch('/api/start-experiment', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.status === 401) {
                throw new Error('Tu sesión ha expirado. Por favor inicia sesión de nuevo.');
            }
            if (!response.ok) {
                throw new Error(data.error || 'Ocurrió un error al arrancar la tarea.');
            }

            const runId = data.runId;
            appendConsoleLine(consoleLogs, `[SISTEMA] Experimento creado con éxito en tu directorio. ID: ${runId}`, 'success');

            // Establish Server-Sent Events connection to stream logs in real-time
            listenToLogs(runId, processingBubble);

        } catch (err) {
            console.error(err);
            processingBubble.remove();
            appendMessage(chatMessages, 'assistant', `
                <p>⚠️ <strong>Ha ocurrido un error al arrancar el experimento:</strong></p>
                <p style="color: #ef4444;">${err.message}</p>
                <p>Por favor, revisa que los datos y el archivo sean válidos y vuelve a intentarlo.</p>
            `);
            appendConsoleLine(consoleLogs, `[ERROR] Falló el arranque: ${err.message}`, 'error');
            resetForm();
            if (err.message.includes('sesión ha expirado') || err.message.includes('No autorizado')) {
                showAuth();
            }
        }
    });

    function listenToLogs(runId, processingBubble) {
        const progressFill = document.getElementById('run-progress-fill');
        const progressText = document.getElementById('run-progress-text');

        if (state.eventSource) {
            state.eventSource.close();
        }

        state.eventSource = new EventSource(`/api/stream-logs/${runId}`);

        state.eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            // Check for special END message
            if (data.status === 'completed' && data.text === 'DONE') {
                state.eventSource.close();
                handleSuccess(runId, processingBubble);
                return;
            }

            if (data.status === 'failed') {
                state.eventSource.close();
                handleFailure(data.text, processingBubble);
                return;
            }

            // Print normal progress line in console
            if (data.text.startsWith('[ERR]')) {
                appendConsoleLine(consoleLogs, data.text, 'error');
            } else {
                appendConsoleLine(consoleLogs, data.text);
            }

            // Update UI Progress and status texts depending on pipeline step
            let percent = 10;
            let statusLabel = 'Procesando...';

            switch (data.status) {
                case 'preparing':
                    percent = 15;
                    statusLabel = 'Aislando el entorno de tu cuenta...';
                    break;
                case 'prepare':
                    percent = 35;
                    statusLabel = 'Ejecutando prepare_experiment.py (Dividiendo en lotes)...';
                    break;
                case 'execute':
                    percent = 65;
                    statusLabel = 'Ejecutando execute_experiment.py (Evaluando con LLMs en la API)...';
                    break;
                case 'compile':
                    percent = 85;
                    statusLabel = 'Ejecutando generateResults.py (Compilando resultados XLSX)...';
                    break;
                case 'cleanup':
                    percent = 90;
                    statusLabel = 'Borrando archivos confidenciales del servidor...';
                    break;
                case 'compress':
                    percent = 95;
                    statusLabel = 'Empaquetando tu directorio de experimento en ZIP...';
                    break;
                case 'completed':
                    percent = 100;
                    statusLabel = '¡Completado!';
                    break;
            }

            if (progressFill) progressFill.style.width = `${percent}%`;
            if (progressText) progressText.textContent = `${statusLabel}`;
            systemStatus.textContent = statusLabel;
        };

        state.eventSource.onerror = (err) => {
            console.error('SSE Error:', err);
            state.eventSource.close();
        };
    }

    function handleSuccess(runId, processingBubble) {
        // Remove progress bar
        processingBubble.remove();

        // Auto-expand console drawer for scientific feedback
        consoleDrawer.classList.remove('collapsed');
        consoleDrawer.classList.add('expanded');
        toggleConsole.querySelector('.toggle-arrow').textContent = '▼';

        appendConsoleLine(consoleLogs, `[SISTEMA] --- PROCESO COMPLETADO SATISFACTORIAMENTE ---`, 'success');
        systemStatus.textContent = 'Experimento completado exitosamente';

        const successText = `🎉 ¡Felicidades! He completado exitosamente todo el pipeline psicolingüístico.

Se ha generado el archivo **XLSX** final, la bitácora detallada de mis pensamientos (<code>pensamiento_log.txt</code>) y la configuración del experimento.

He limpiado de forma segura las llaves del servidor y he empaquetado todo el espacio de trabajo de tu experimento privado en un único archivo comprimido ZIP.`;

        appendMessage(chatMessages, 'assistant', `
            <p>${formatMarkdown(successText)}</p>
            
            <div class="download-box">
                <div class="download-info">
                    <span class="download-icon">📦</span>
                    <div>
                        <div class="download-title">Experimento Completo</div>
                        <div class="download-subtitle">ID: ${runId} (Formato .ZIP)</div>
                    </div>
                </div>
                <a href="/api/download/${runId}" class="download-btn">Descargar ZIP 📥</a>
            </div>
        `);

        // Record to chat history
        state.chatHistory.push({ role: 'assistant', content: `Experimento completado con éxito. ID: ${runId}. Archivo ZIP listo para descarga.` });

        resetForm();
    }

    function handleFailure(errorMessage, processingBubble) {
        processingBubble.remove();
        systemStatus.textContent = 'La ejecución falló';
        
        appendConsoleLine(consoleLogs, `[SISTEMA] ERROR: La ejecución falló. Detalles: ${errorMessage}`, 'error');

        appendMessage(chatMessages, 'assistant', `
            <p>⚠️ <strong>Lo siento, la ejecución del experimento ha fallado.</strong></p>
            <p>Ocurrió un error durante la ejecución de los scripts de Python:</p>
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px; color: #991b1b; font-family: var(--font-mono); font-size: 13px; margin: 10px 0;">
                ${errorMessage}
            </div>
            <p>Por favor, revisa el panel de la consola aquí abajo para ver los logs detallados del error y de la ejecución de Python. Asegúrate de que las API Keys de <code>apis_example.env</code> sean válidas y el formato del Excel sea correcto.</p>
        `);

        state.chatHistory.push({ role: 'assistant', content: `El experimento falló con el error: ${errorMessage}` });

        resetForm();
    }

    function resetForm() {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Iniciar Evaluación 🚀';
    }

    return {
        listenToLogs,
        handleSuccess,
        handleFailure,
        resetForm
    };
}
