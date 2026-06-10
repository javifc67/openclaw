document.addEventListener('DOMContentLoaded', () => {
    // Auth Elements
    const authContainer = document.getElementById('auth-container');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const goToRegister = document.getElementById('go-to-register');
    const goToLogin = document.getElementById('go-to-login');
    const authError = document.getElementById('auth-error');
    const currentUserDisplay = document.getElementById('current-user-display');
    const logoutBtn = document.getElementById('logout-btn');

    // App Elements
    const form = document.getElementById('experiment-form');
    const submitBtn = document.getElementById('submit-btn');
    const chatMessages = document.getElementById('chat-messages');
    const consoleLogs = document.getElementById('console-logs');
    const toggleConsole = document.getElementById('toggle-console');
    const consoleDrawer = document.getElementById('console-drawer');
    const systemStatus = document.getElementById('system-status');
    const clearChatBtn = document.getElementById('clear-chat');

    // Chat Input Elements
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');

    let eventSource = null;
    let chatHistory = []; // Local memory to store the conversation transcript ({ role, content })
    let userLanguage = 'es'; // Default language preference

    // Language Dropdown elements
    const authLangSelect = document.getElementById('auth-lang-select');
    const appLangSelect = document.getElementById('app-lang-select');
    const attachBtn = document.getElementById('attach-btn');

    // Localization Dictionary
    const translations = {
        es: {
            authTitle: "Acceso Científico",
            authSubtitle: "Framework de Evaluación Psicolingüística",
            loginUsernameLabel: "👤 Nombre de usuario",
            loginUsernamePlaceholder: "Tu usuario",
            loginPasswordLabel: "🔒 Contraseña",
            loginPasswordPlaceholder: "Tu contraseña",
            loginBtn: "Entrar 🔓",
            goToRegister: "¿No tienes cuenta? Registrar nueva cuenta",
            regUsernameLabel: "👤 Crear nombre de usuario",
            regUsernamePlaceholder: "Solo minúsculas, números o guiones bajos",
            regUsernameHelp: "Será el nombre de tu carpeta de experimentos.",
            regPasswordLabel: "🔒 Crear contraseña",
            regPasswordPlaceholder: "Mínimo 6 caracteres",
            regLanguageLabel: "🌐 Idioma del Agente / Agent Language",
            regSystemKeyLabel: "🔑 Clave de acceso del sistema",
            regSystemKeyPlaceholder: "Clave institucional de autorización",
            regSystemKeyHelp: "Clave de sistema requerida para autorizar tu registro.",
            regBtn: "Registrarse y Entrar 🚀",
            goToLogin: "¿Ya tienes cuenta? Iniciar sesión",
            agentHeaderTitle: "Chat del Agente Psicolingüístico",
            systemStatusReady: "Listo para procesar tu experimento",
            systemStatusRunning: "Experimento en ejecución...",
            logoutBtn: "Salir 🚪",
            clearChatTitle: "Limpiar chat",
            attachBtnTitle: "Adjuntar archivo Excel/CSV",
            chatInputPlaceholder: "Pregúntale al Agente Psicolingüístico sobre tu experimento...",
            sendBtn: "Enviar ✉️",
            consoleTitle: "📜 Consola de ejecución en tiempo real (Python Logs)",
            consoleOpened: "[SISTEMA] Consola abierta. Los logs de los scripts de Python aparecerán aquí en vivo..."
        },
        en: {
            authTitle: "Scientific Access",
            authSubtitle: "Psycholinguistics Evaluation Framework",
            loginUsernameLabel: "👤 Username",
            loginUsernamePlaceholder: "Your username",
            loginPasswordLabel: "🔒 Password",
            loginPasswordPlaceholder: "Your password",
            loginBtn: "Login 🔓",
            goToRegister: "Don't have an account? Register new account",
            regUsernameLabel: "👤 Create username",
            regUsernamePlaceholder: "Lowercase letters, numbers, or underscores only",
            regUsernameHelp: "This will be the name of your experiment folder.",
            regPasswordLabel: "🔒 Create password",
            regPasswordPlaceholder: "Minimum 6 characters",
            regLanguageLabel: "🌐 Agent Language",
            regSystemKeyLabel: "🔑 System Access Key",
            regSystemKeyPlaceholder: "Institutional authorization key",
            regSystemKeyHelp: "System key required to authorize your registration.",
            regBtn: "Register and Login 🚀",
            goToLogin: "Already have an account? Login",
            agentHeaderTitle: "Psycholinguistic Agent Chat",
            systemStatusReady: "Ready to process your experiment",
            systemStatusRunning: "Experiment running...",
            logoutBtn: "Logout 🚪",
            clearChatTitle: "Clear chat",
            attachBtnTitle: "Attach Excel/CSV file",
            chatInputPlaceholder: "Ask the Psycholinguistic Agent about your experiment...",
            sendBtn: "Send ✉️",
            consoleTitle: "📜 Real-time execution console (Python Logs)",
            consoleOpened: "[SYSTEM] Console opened. Python script logs will appear here live..."
        }
    };

    // Detect browser language
    function detectBrowserLanguage() {
        const lang = navigator.language || navigator.userLanguage;
        if (lang && lang.toLowerCase().startsWith('es')) {
            return 'es';
        }
        return 'en';
    }

    // Apply translations and update dropdowns
    function applyFrontendLanguage(lang) {
        userLanguage = lang;
        
        if (authLangSelect) authLangSelect.value = lang;
        if (appLangSelect) appLangSelect.value = lang;

        const t = translations[lang];

        // Auth Header
        const authTitle = document.getElementById('auth-title');
        if (authTitle) authTitle.textContent = t.authTitle;
        const authSubtitle = document.getElementById('auth-subtitle');
        if (authSubtitle) authSubtitle.textContent = t.authSubtitle;

        // Login labels & placeholders
        const loginUserLabel = document.querySelector('label[for="login-username"]');
        if (loginUserLabel) loginUserLabel.textContent = t.loginUsernameLabel;
        const loginUserIn = document.getElementById('login-username');
        if (loginUserIn) loginUserIn.placeholder = t.loginUsernamePlaceholder;

        const loginPassLabel = document.querySelector('label[for="login-password"]');
        if (loginPassLabel) loginPassLabel.textContent = t.loginPasswordLabel;
        const loginPassIn = document.getElementById('login-password');
        if (loginPassIn) loginPassIn.placeholder = t.loginPasswordPlaceholder;

        const loginBtn = document.getElementById('login-btn');
        if (loginBtn) loginBtn.textContent = t.loginBtn;

        if (goToRegister) goToRegister.textContent = t.goToRegister;

        // Register labels & placeholders
        const regUserLabel = document.querySelector('label[for="reg-username"]');
        if (regUserLabel) regUserLabel.textContent = t.regUsernameLabel;
        const regUserIn = document.getElementById('reg-username');
        if (regUserIn) regUserIn.placeholder = t.regUsernamePlaceholder;
        const regUserHelp = document.querySelector('#register-form .help-text');
        if (regUserHelp) regUserHelp.textContent = t.regUsernameHelp;

        const regPassLabel = document.querySelector('label[for="reg-password"]');
        if (regPassLabel) regPassLabel.textContent = t.regPasswordLabel;
        const regPassIn = document.getElementById('reg-password');
        if (regPassIn) regPassIn.placeholder = t.regPasswordPlaceholder;

        const regLangLabel = document.querySelector('label[for="reg-language"]');
        if (regLangLabel) regLangLabel.textContent = t.regLanguageLabel;

        const regSysLabel = document.querySelector('label[for="reg-system-key"]');
        if (regSysLabel) regSysLabel.textContent = t.regSystemKeyLabel;
        const regSysIn = document.getElementById('reg-system-key');
        if (regSysIn) regSysIn.placeholder = t.regSystemKeyPlaceholder;
        const regSysHelp = document.querySelector('#register-form .help-text');
        if (regSysHelp) regSysHelp.textContent = t.regSystemKeyHelp;

        const regBtn = document.getElementById('register-btn');
        if (regBtn) regBtn.textContent = t.regBtn;

        if (goToLogin) goToLogin.textContent = t.goToLogin;

        // App/Header labels
        const agentHeaderTitle = document.getElementById('agent-header-title');
        if (agentHeaderTitle) agentHeaderTitle.textContent = t.agentHeaderTitle;

        const systemStatus = document.getElementById('system-status');
        if (systemStatus) {
            systemStatus.textContent = systemStatus.textContent.includes('ejecución') || systemStatus.textContent.includes('running')
                ? t.systemStatusRunning
                : t.systemStatusReady;
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.textContent = t.logoutBtn;

        if (clearChatBtn) clearChatBtn.title = t.clearChatTitle;
        if (attachBtn) attachBtn.title = t.attachBtnTitle;
        if (chatInput) chatInput.placeholder = t.chatInputPlaceholder;

        const sendBtn = document.getElementById('send-chat-btn');
        if (sendBtn) sendBtn.textContent = t.sendBtn;

        const toggleConsole = document.getElementById('toggle-console');
        if (toggleConsole) toggleConsole.querySelector('span').textContent = t.consoleTitle;
    }

    // Update user language backend preferences on selection change
    async function updateBackendLanguage(lang) {
        try {
            await fetch('/api/auth/update-language', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ language: lang })
            });
        } catch (err) {
            console.error('Failed to save language preference on backend:', err);
        }
    }

    // Set up language selector event listeners
    if (authLangSelect) {
        authLangSelect.addEventListener('change', (e) => {
            const selectedLang = e.target.value;
            applyFrontendLanguage(selectedLang);
            
            // Also update the register agent language default selector to match
            const regLanguageSelect = document.getElementById('reg-language');
            if (regLanguageSelect) regLanguageSelect.value = selectedLang;
        });
    }

    if (appLangSelect) {
        appLangSelect.addEventListener('change', (e) => {
            const selectedLang = e.target.value;
            applyFrontendLanguage(selectedLang);
            updateBackendLanguage(selectedLang);
            
            // Refresh conversation messages dynamically (like the welcome message)
            if (chatHistory.length === 1 && chatHistory[0].role === 'assistant') {
                showWelcomeMessage();
            }
        });
    }

    // Auto-detect browser language and initialize defaults
    const browserLang = detectBrowserLanguage();
    applyFrontendLanguage(browserLang);

    // Default the Register form's Agent language dropdown to match browser language
    const regLanguageSelect = document.getElementById('reg-language');
    if (regLanguageSelect) {
        regLanguageSelect.value = browserLang;
    }

    // --- Authentication Logic ---

    // Toggle forms
    goToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        authError.classList.add('hidden');
    });

    goToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        authError.classList.add('hidden');
    });

    // Check if user is already logged in
    async function checkSession() {
        try {
            const res = await fetch('/api/auth/session');
            const data = await res.json();
            if (data.loggedIn) {
                showApp(data.username, data.language);
            } else {
                showAuth();
            }
        } catch (err) {
            console.error('Session check failed', err);
            showAuth();
        }
    }

    function showAuth() {
        authContainer.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }

    function showWelcomeMessage() {
        chatMessages.innerHTML = '';
        
        let welcomeText = '';
        if (userLanguage === 'en') {
            welcomeText = `# Introduction

Welcome to the **ChatWords2.0 Psycholinguistic Evaluation Portal**.

This chatbot is designed to **automatically run psycholinguistic feature evaluation experiments** under different scenarios, as defined in [Adding LLMs to the psycholinguistic norming toolbox: A practical guide to getting the most out of human ratings](https://arxiv.org/abs/2509.14405) following the [official framework](https://github.com/WordsGPT/psycholinguistics_framework), guaranteeing the **transparency and reproducibility** required in **scientific research**.

1. **First, you will need to upload a CSV or Excel file** with the words/phrases you want to evaluate. Click on the **paperclip button 📎** to upload your **Excel or CSV file** of words.
2. **Next, I will ask you to choose the model** you want to use (currently we **only support gpt-4o-mini**, but future versions will allow more models, including **open-source models**).
3. **I will also ask you to provide the prompt**, for example: *"Complete the following task as a native speaker of English. Familiarity is a measure of how familiar something is. An English word is very FAMILIAR if you see/hear it often and it is easily recognisable. In contrast, an English word is very UNFAMILIAR if you rarely see/hear it and it is relatively unrecognisable. Please indicate how familiar you think this English word is on a scale from 1 (VERY UNFAMILIAR) to 7 (VERY FAMILIAR), with the midpoint representing moderate familiarity. The English word is: "{Word}". Only answer a number from 1 to 7. Please limit your answer to numbers."*
4. **I will run the experiment on the server** and provide the **results ZIP** and the **final XLSX** directly here for you to download with a **single click**. It will contain all the **experiment configuration data**, making the process **transparent and reproducible**.

**What would you like to evaluate today?** Upload your file or write to me to get started! 🧠🚀`;
        } else {
            welcomeText = `# Introducción

Bienvenido al **Portal de Evaluación Psicolingüística ChatWords2.0**.

Este chatbot está diseñado para **ejecutar automáticamente experimentos de evaluación de características psicolingüísticas** bajo diferentes escenarios, tal como se define en [Adding LLMs to the psycholinguistic norming toolbox: A practical guide to getting the most out of human ratings](https://arxiv.org/abs/2509.14405) siguiendo el [framework oficial](https://github.com/WordsGPT/psycholinguistics_framework), garantizando la **transparencia y reproducibilidad** requeridas en la **investigación científica**.

1. **Primero, necesitarás subir un archivo CSV o Excel** con las palabras/frases que deseas evaluar. Haz clic en el **botón de clip 📎** para subir tu **archivo Excel o CSV** de palabras.
2. **A continuación, te pediré que elijas el modelo** que deseas utilizar (actualmente **solo soportamos gpt-4o-mini**, pero las versiones futuras permitirán más modelos, incluyendo **modelos de código abierto**).
3. **También te pediré que proporciones el prompt**, por ejemplo: *"Completa la siguiente tarea como hablante nativo de español. La familiaridad es una medida de qué tan familiar es algo. Una palabra en español es muy FAMILIAR si la ves/escuchas a menudo y es fácilmente reconocible. En contraste, una palabra en español es muy POCO FAMILIAR si raramente la ves/escuchas y es relativamente irreconocible. Por favor, indica qué tan familiar crees que es esta palabra en español en una escala del 1 (MUY POCO FAMILIAR) al 7 (MUY FAMILIAR), donde el punto medio representa una familiaridad moderada. La palabra en español es: "{Word}". Responde únicamente con un número del 1 al 7. Por favor, limita tu respuesta a números."*
4. **Ejecutaré el experimento en el servidor** y te entregaré el **ZIP de resultados** y el **XLSX final** directamente aquí para que los descargues con un **solo clic**. Contendrá todos los **datos de configuración del experimento**, haciendo que el proceso sea **transparente y reproducible**.

**¿Qué te gustaría evaluar hoy?** ¡Sube tu archivo o escríbeme para comenzar! 🧠🚀`;
        }

        appendMessage('assistant', formatMarkdown(welcomeText));
        chatHistory = [{ role: 'assistant', content: welcomeText }];
    }

    async function loadHistory() {
        try {
            const res = await fetch('/api/chat-history');
            const data = await res.json();
            
            if (data.history && data.history.length > 0) {
                // Clear welcome message
                chatMessages.innerHTML = '';
                chatHistory = [];
                
                // Append each message
                data.history.forEach(msg => {
                    if (msg.content && msg.content.trim()) {
                        appendMessage(msg.role, formatMarkdown(msg.content));
                        chatHistory.push(msg);
                    }
                });
                
                const systemHistoryText = userLanguage === 'en'
                    ? '[SYSTEM] Chat history successfully recovered from OpenClaw.'
                    : '[SISTEMA] Historial de chat recuperado con éxito de OpenClaw.';
                appendConsoleLine(systemHistoryText, 'success');
            } else {
                const systemNoHistoryText = userLanguage === 'en'
                    ? '[SYSTEM] No previous chat history found. Starting new conversation.'
                    : '[SISTEMA] No se encontró historial previo de chat. Iniciando nueva conversación.';
                appendConsoleLine(systemNoHistoryText, 'normal');
                showWelcomeMessage();
            }
        } catch (err) {
            console.error('Failed to load chat history:', err);
            const systemErrorText = userLanguage === 'en'
                ? '[ERROR] Failed to load previous chat history.'
                : '[ERROR] No se pudo cargar el historial de chat anterior.';
            appendConsoleLine(systemErrorText, 'error');
        }
    }

    function showApp(username, language) {
        authContainer.classList.add('hidden');
        mainApp.classList.remove('hidden');
        currentUserDisplay.textContent = username;
        userLanguage = language || 'es';
        
        applyFrontendLanguage(userLanguage);
        
        // Fetch actual conversation history from OpenClaw
        loadHistory();
    }

    // Handle Login Submit
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.classList.add('hidden');

        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Credenciales inválidas');

            showApp(data.username, data.language);
        } catch (err) {
            authError.textContent = err.message;
            authError.classList.remove('hidden');
        }
    });

    // Handle Register Submit
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        authError.classList.add('hidden');

        const username = document.getElementById('reg-username').value;
        const password = document.getElementById('reg-password').value;
        const systemKey = document.getElementById('reg-system-key').value;
        const language = document.getElementById('reg-language').value;

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, systemKey, language })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Fallo en el registro');

            showApp(data.username, data.language);
        } catch (err) {
            authError.textContent = err.message;
            authError.classList.remove('hidden');
        }
    });

    // Handle Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            if (eventSource) eventSource.close();
            showAuth();
            document.getElementById('login-password').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-system-key').value = '';
        } catch (err) {
            console.error('Logout failed', err);
        }
    });


    // --- Core Portal / Chat Logic ---

    // Toggle Console Drawer height
    toggleConsole.addEventListener('click', () => {
        if (consoleDrawer.classList.contains('collapsed')) {
            consoleDrawer.classList.remove('collapsed');
            consoleDrawer.classList.add('expanded');
            toggleConsole.querySelector('.toggle-arrow').textContent = '▼';
        } else {
            consoleDrawer.classList.remove('expanded');
            consoleDrawer.classList.add('collapsed');
            toggleConsole.querySelector('.toggle-arrow').textContent = '▲';
        }
    });

    // Format basic Markdown into HTML
    function formatMarkdown(text) {
        if (!text) return '';
        
        let formatted = text;

        // Code blocks: ```content```
        formatted = formatted.replace(/```(?:\w+\n)?([\s\S]*?)```/g, '<pre><code>$1</code></pre>');

        // Inline code: `code`
        formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Links: [text](url) -> <a href="url" target="_blank" rel="noopener noreferrer">text</a>
        formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // Bold: **text** or __text__
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        formatted = formatted.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // Italic: *text* or _text_ (excluding bullet spaces/line starts)
        formatted = formatted.replace(/(?<!\*)\*([^* \n][^*]*?[^* \n]?)\*(?!\*)/g, '<em>$1</em>');
        formatted = formatted.replace(/(?<!_)_([^_ \n][^_]*?[^_ \n]?)_(?!_)/g, '<em>$1</em>');

        // Headers
        formatted = formatted.replace(/^### (.*$)/gim, '<h3>$1</h3>');
        formatted = formatted.replace(/^## (.*$)/gim, '<h2>$1</h2>');
        formatted = formatted.replace(/^# (.*$)/gim, '<h1>$1</h1>');

        // Lists: Unordered and Ordered line-by-line
        const lines = formatted.split('\n');
        let inList = false;
        let inOrderedList = false;
        
        const processedLines = lines.map(line => {
            let trimmed = line.trim();
            
            // Skip code blocks and special divs from processing
            if (line.includes('<pre>') || line.includes('<code>') || line.includes('<pre><code>') || line.includes('</pre>') || line.includes('</code>') || line.includes('<div') || line.includes('</div>')) {
                return line;
            }

            // Unordered list item: * or -
            const ulMatch = line.match(/^(\s*)[*\-+]\s+(.*)$/);
            if (ulMatch) {
                let prefix = '';
                if (inOrderedList) {
                    prefix += '</ol>';
                    inOrderedList = false;
                }
                if (!inList) {
                    prefix += '<ul>';
                    inList = true;
                }
                return prefix + `<li>${ulMatch[2]}</li>`;
            }

            // Ordered list item: 1.
            const olMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);
            if (olMatch) {
                let prefix = '';
                if (inList) {
                    prefix += '</ul>';
                    inList = false;
                }
                if (!inOrderedList) {
                    prefix += '<ol>';
                    inOrderedList = true;
                }
                return prefix + `<li>${olMatch[2]}</li>`;
            }

            // Normal line
            let prefix = '';
            if (inList) {
                prefix += '</ul>';
                inList = false;
            }
            if (inOrderedList) {
                prefix += '</ol>';
                inOrderedList = false;
            }

            if (trimmed === '' || trimmed.startsWith('<h')) {
                return prefix + line;
            }
            
            return prefix + line + '<br>';
        });

        if (inList) processedLines.push('</ul>');
        if (inOrderedList) processedLines.push('</ol>');

        return processedLines.join('\n');
    }

    // Clear Chat
    clearChatBtn.addEventListener('click', async () => {
        const currentUsername = currentUserDisplay.textContent || 'investigador';
        let welcomeText = '';
        if (userLanguage === 'en') {
            welcomeText = `Hello **${currentUsername}**! I have cleared your history for this session.

# Introduction

Welcome to the **ChatWords2.0 Psycholinguistic Evaluation Portal**.

This chatbot is designed to **automatically run psycholinguistic feature evaluation experiments** under different scenarios, as defined in [Adding LLMs to the psycholinguistic norming toolbox: A practical guide to getting the most out of human ratings](https://arxiv.org/abs/2509.14405) following the [official framework](https://github.com/WordsGPT/psycholinguistics_framework), guaranteeing the **transparency and reproducibility** required in **scientific research**.

1. **First, you will need to upload a CSV or Excel file** with the words/phrases you want to evaluate. Click on the **paperclip button 📎** to upload your **Excel or CSV file** of words.
2. **Next, I will ask you to choose the model** you want to use (currently we **only support gpt-4o-mini**, but future versions will allow more models, including **open-source models**).
3. **I will also ask you to provide the prompt**, for example: *"Complete the following task as a native speaker of English. Familiarity is a measure of how familiar something is. An English word is very FAMILIAR if you see/hear it often and it is easily recognisable. In contrast, an English word is very UNFAMILIAR if you rarely see/hear it and it is relatively unrecognisable. Please indicate how familiar you think this English word is on a scale from 1 (VERY UNFAMILIAR) to 7 (VERY FAMILIAR), with the midpoint representing moderate familiarity. The English word is: "{Word}". Only answer a number from 1 to 7. Please limit your answer to numbers."*
4. **I will run the experiment on the server** and provide the **results ZIP** and the **final XLSX** directly here for you to download with a **single click**. It will contain all the **experiment configuration data**, making the process **transparent and reproducible**.

**What would you like to evaluate today?** Upload your file or write to me to get started! 🧠🚀`;
        } else {
            welcomeText = `¡Hola **${currentUsername}**! He limpiado tu historial de esta sesión.

# Introducción

Bienvenido al **Portal de Evaluación Psicolingüística ChatWords2.0**.

Este chatbot está diseñado para **ejecutar automáticamente experimentos de evaluación de características psicolingüísticas** bajo diferentes escenarios, tal como se define en [Adding LLMs to the psycholinguistic norming toolbox: A practical guide to getting the most out of human ratings](https://arxiv.org/abs/2509.14405) siguiendo el [framework oficial](https://github.com/WordsGPT/psycholinguistics_framework), garantizando la **transparencia y reproducibilidad** requeridas en la **investigación científica**.

1. **Primero, necesitarás subir un archivo CSV o Excel** con las palabras/frases que deseas evaluar. Haz clic en el **botón de clip 📎** para subir tu **archivo Excel o CSV** de palabras.
2. **A continuación, te pediré que elijas el modelo** que deseas utilizar (actualmente **solo soportamos gpt-4o-mini**, pero las versiones futuras permitirán más modelos, incluyendo **modelos de código abierto**).
3. **También te pediré que proporciones el prompt**, por ejemplo: *"Completa la siguiente tarea como hablante nativo de español. La familiaridad es una medida de qué tan familiar es algo. Una palabra en español es muy FAMILIAR si la ves/escuchas a menudo y es fácilmente reconocible. En contraste, una palabra en español es muy POCO FAMILIAR si raramente la ves/escuchas y es relativamente irreconocible. Por favor, indica qué tan familiar crees que es esta palabra en español en una escala del 1 (MUY POCO FAMILIAR) al 7 (MUY FAMILIAR), donde el punto medio representa una familiaridad moderada. La palabra en español es: "{Word}". Responde únicamente con un número del 1 al 7. Por favor, limita tu respuesta a números."*
4. **Ejecutaré el experimento en el servidor** y te entregaré el **ZIP de resultados** y el **XLSX final** directamente aquí para que los descargues con un **solo clic**. Contendrá todos los **datos de configuración del experimento**, haciendo que el proceso sea **transparente y reproducible**.

**¿Qué te gustaría evaluar hoy?** ¡Sube tu archivo o escríbeme para comenzar! 🧠🚀`;
        }

        try {
            // Also notify the backend to reset the persistent OpenClaw session history!
            await fetch('/api/clear-chat', { method: 'POST' });
            const successText = userLanguage === 'en'
                ? '[SYSTEM] Chat session in OpenClaw reset successfully.'
                : '[SISTEMA] Sesión de chat en OpenClaw reiniciada con éxito.';
            appendConsoleLine(successText, 'success');
        } catch (err) {
            console.error('Error resetting chat session:', err);
            const errorText = userLanguage === 'en'
                ? '[ERROR] Could not reset chat session on server.'
                : '[ERROR] No se pudo reiniciar la sesión de chat en el servidor.';
            appendConsoleLine(errorText, 'error');
        }

        chatMessages.innerHTML = `
            <div class="message assistant">
                <div class="avatar">🧠</div>
                <div class="message-content">
                    ${formatMarkdown(welcomeText)}
                </div>
            </div>
        `;
        const consoleClearText = userLanguage === 'en'
            ? `<div class="console-line system">[SYSTEM] History cleared. Ready to receive new execution logs...</div>`
            : `<div class="console-line system">[SISTEMA] Historial limpiado. Listo para recibir nuevos logs de ejecución...</div>`;
        consoleLogs.innerHTML = consoleClearText;
        
        // Reset local chat history
        chatHistory = [{ role: 'assistant', content: welcomeText }];
    });

    // File Upload / Attachment Handling
    const chatFileInput = document.getElementById('chat-file-input');

    if (attachBtn && chatFileInput) {
        attachBtn.addEventListener('click', () => {
            chatFileInput.click();
        });

        chatFileInput.addEventListener('change', async () => {
            const file = chatFileInput.files[0];
            if (!file) return;

            // Reset file input value so same file can be selected again
            chatFileInput.value = '';

            const uploadingLabel = userLanguage === 'en' ? 'Uploading file:' : 'Subiendo archivo:';
            const waitLabel = userLanguage === 'en' ? 'Please wait a moment...' : 'Por favor, espera un momento...';

            // Show uploading indicator
            const uploadIndicator = appendMessage('user', `
                <div style="display: flex; gap: 8px; align-items: center;">
                    <span style="font-size: 20px;">📎</span>
                    <div>
                        <strong>${uploadingLabel}</strong> <code>${file.name}</code><br>
                        <span style="font-size: 12px; color: #64748b; font-style: italic;">${waitLabel}</span>
                    </div>
                </div>
            `);

            const formData = new FormData();
            formData.append('chatFile', file);

            try {
                const res = await fetch('/api/chat-upload', {
                    method: 'POST',
                    body: formData
                });

                const data = await res.json();
                uploadIndicator.remove();

                if (!res.ok) {
                    throw new Error(data.error || 'Error al subir el archivo.');
                }

                const successUploadText = userLanguage === 'en' ? 'File uploaded successfully to server' : 'Archivo subido con éxito al servidor';

                // Append beautiful success message
                appendMessage('user', `
                    <div style="display: flex; gap: 12px; align-items: center; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-md); padding: 12px 16px; max-width: 450px;">
                        <span style="font-size: 24px;">📄</span>
                        <div style="display: flex; flex-direction: column;">
                            <span style="font-weight: 600; color: #166534; font-size: 14px;">${data.fileName}</span>
                            <span style="font-size: 11px; color: #15803d;">${successUploadText}</span>
                        </div>
                    </div>
                `);

                // Push trigger message to chat history so the agent receives the file path context
                const triggerText = userLanguage === 'en'
                    ? `I have uploaded the file: ${data.fileName}. It is saved in my workspace at: ${data.filePath}. Please use it for evaluation.`
                    : `He subido el archivo: ${data.fileName}. Está guardado en mi espacio de trabajo en la ruta: ${data.filePath}. Por favor, utilízalo para la evaluación.`;
                chatHistory.push({ role: 'user', content: triggerText });

                const processingFileText = userLanguage === 'en' ? 'The Agent is processing your file...' : 'El Agente está procesando tu archivo...';

                // Automatically trigger agent turn
                const typingBubble = appendMessage('assistant', `
                    <div style="display: flex; gap: 4px; align-items: center; padding: 4px 0;">
                        <span style="font-style: italic; color: #64748b;">${processingFileText}</span>
                    </div>
                `);

                chatInput.disabled = true;
                sendChatBtn.disabled = true;

                const chatRes = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: chatHistory.slice(-15) })
                });

                const chatData = await chatRes.json();
                typingBubble.remove();

                if (!chatRes.ok) {
                    throw new Error(chatData.error || 'Error al procesar el chat con el archivo.');
                }

                appendMessage('assistant', formatMarkdown(chatData.reply));
                chatHistory.push({ role: 'assistant', content: chatData.reply });

            } catch (err) {
                console.error(err);
                if (uploadIndicator) uploadIndicator.remove();
                const attachmentErrorText = userLanguage === 'en' ? 'Error processing your attachment:' : 'Error al procesar tu archivo adjunto:';
                appendMessage('assistant', `
                    <p>⚠️ <strong>${attachmentErrorText}</strong></p>
                    <p style="color: #ef4444;">${err.message}</p>
                `);
            } finally {
                chatInput.disabled = false;
                sendChatBtn.disabled = false;
                chatInput.focus();
            }
        });
    }

    // Helper to append chat messages
    function appendMessage(sender, htmlContent) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const avatar = sender === 'assistant' ? '🧠' : '👤';
        
        messageDiv.innerHTML = `
            <div class="avatar">${avatar}</div>
            <div class="message-content">
                ${htmlContent}
            </div>
        `;
        
        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return messageDiv;
    }

    // Helper to append lines to Console drawer
    function appendConsoleLine(text, type = 'normal') {
        const line = document.createElement('div');
        line.className = `console-line ${type}`;
        line.textContent = text;
        consoleLogs.appendChild(line);
        consoleLogs.scrollTop = consoleLogs.scrollHeight;
    }

    // --- Interactive Conversational Chat ---

    async function sendUserChatMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        // Clear input and show on screen
        chatInput.value = '';
        appendMessage('user', `<p>${text}</p>`);
        
        // Save to context history
        chatHistory.push({ role: 'user', content: text });

        const formulatingText = userLanguage === 'en' ? 'The Agent is formulating a response...' : 'El Agente está formulando una respuesta...';

        // Show typing indicator
        const typingBubble = appendMessage('assistant', `
            <div style="display: flex; gap: 4px; align-items: center; padding: 4px 0;">
                <span style="font-style: italic; color: #64748b;">${formulatingText}</span>
            </div>
        `);

        // Disable input during request
        chatInput.disabled = true;
        sendChatBtn.disabled = true;

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatHistory.slice(-15) })
            });

            const data = await res.json();
            typingBubble.remove();

            if (!res.ok) {
                throw new Error(data.error || 'Error al obtener respuesta del agente.');
            }

            // Append assistant reply formatted
            appendMessage('assistant', formatMarkdown(data.reply));
            
            // Push to history
            chatHistory.push({ role: 'assistant', content: data.reply });

        } catch (err) {
            console.error(err);
            typingBubble.remove();
            const sorryText = userLanguage === 'en' ? 'Sorry, an error occurred while communicating with you:' : 'Lo siento, ocurrió un error al comunicarme contigo:';
            appendMessage('assistant', `
                <p>⚠️ <strong>${sorryText}</strong></p>
                <p style="color: #ef4444;">${err.message}</p>
            `);
            if (err.message.includes('sesión ha expirado') || err.message.includes('No autorizado')) {
                showAuth();
            }
        } finally {
            chatInput.disabled = false;
            sendChatBtn.disabled = false;
            chatInput.focus();
        }
    }

    // Bind chat events
    sendChatBtn.addEventListener('click', sendUserChatMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendUserChatMessage();
        }
    });


    // --- Experiment Form Submission Logic ---

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
        appendMessage('user', userMsg);
        chatHistory.push({ role: 'user', content: `He iniciado un experimento con archivo: ${fileInput.files[0].name}, columna: ${column}, modelo: ${model}, compilación: ${mode}.` });

        // Add initial agent thinking/processing bubble
        const processingBubble = appendMessage('assistant', `
            <p>He recibido los parámetros y tu archivo. Estoy aislando tu espacio de trabajo en tu directorio de usuario privado e iniciando el pipeline en el servidor...</p>
            <div class="progress-container">
                <div class="progress-bar-bg">
                    <div id="run-progress-fill" class="progress-bar-fill" style="width: 5%"></div>
                </div>
                <span id="run-progress-text" class="progress-text">Inicializando experimento...</span>
            </div>
        `);

        appendConsoleLine(`\n[SISTEMA] --- INICIANDO EXPERIMENTO PRIVADO EN TU DIRECTORIO ---`, 'system');
        appendConsoleLine(`[SISTEMA] Archivo: ${fileInput.files[0].name}`);
        appendConsoleLine(`[SISTEMA] Columna: ${column}`);
        appendConsoleLine(`[SISTEMA] Modelo: ${model}`);
        appendConsoleLine(`[SISTEMA] Modo: ${mode}`);

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
            appendConsoleLine(`[SISTEMA] Experimento creado con éxito en tu directorio. ID: ${runId}`, 'success');

            // Establish Server-Sent Events connection to stream logs in real-time
            listenToLogs(runId, processingBubble);

        } catch (err) {
            console.error(err);
            processingBubble.remove();
            appendMessage('assistant', `
                <p>⚠️ <strong>Ha ocurrido un error al arrancar el experimento:</strong></p>
                <p style="color: #ef4444;">${err.message}</p>
                <p>Por favor, revisa que los datos y el archivo sean válidos y vuelve a intentarlo.</p>
            `);
            appendConsoleLine(`[ERROR] Falló el arranque: ${err.message}`, 'error');
            resetForm();
            if (err.message.includes('sesión ha expirado') || err.message.includes('No autorizado')) {
                showAuth();
            }
        }
    });

    function listenToLogs(runId, processingBubble) {
        const progressFill = document.getElementById('run-progress-fill');
        const progressText = document.getElementById('run-progress-text');

        if (eventSource) {
            eventSource.close();
        }

        eventSource = new EventSource(`/api/stream-logs/${runId}`);

        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            // Check for special END message
            if (data.status === 'completed' && data.text === 'DONE') {
                eventSource.close();
                handleSuccess(runId, processingBubble);
                return;
            }

            if (data.status === 'failed') {
                eventSource.close();
                handleFailure(data.text, processingBubble);
                return;
            }

            // Print normal progress line in console
            if (data.text.startsWith('[ERR]')) {
                appendConsoleLine(data.text, 'error');
            } else {
                appendConsoleLine(data.text);
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

        eventSource.onerror = (err) => {
            console.error('SSE Error:', err);
            eventSource.close();
        };
    }

    function handleSuccess(runId, processingBubble) {
        // Remove progress bar
        processingBubble.remove();

        // Auto-expand console drawer for scientific feedback
        consoleDrawer.classList.remove('collapsed');
        consoleDrawer.classList.add('expanded');
        toggleConsole.querySelector('.toggle-arrow').textContent = '▼';

        appendConsoleLine(`[SISTEMA] --- PROCESO COMPLETADO SATISFACTORIAMENTE ---`, 'success');
        systemStatus.textContent = 'Experimento completado exitosamente';

        const successText = `🎉 ¡Felicidades! He completado exitosamente todo el pipeline psicolingüístico.

Se ha generado el archivo **XLSX** final, la bitácora detallada de mis pensamientos (<code>pensamiento_log.txt</code>) y la configuración del experimento.

He limpiado de forma segura las llaves del servidor y he empaquetado todo el espacio de trabajo de tu experimento privado en un único archivo comprimido ZIP.`;

        appendMessage('assistant', `
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
        chatHistory.push({ role: 'assistant', content: `Experimento completado con éxito. ID: ${runId}. Archivo ZIP listo para descarga.` });

        resetForm();
    }

    function handleFailure(errorMessage, processingBubble) {
        processingBubble.remove();
        systemStatus.textContent = 'La ejecución falló';
        
        appendConsoleLine(`[SISTEMA] ERROR: La ejecución falló. Detalles: ${errorMessage}`, 'error');

        appendMessage('assistant', `
            <p>⚠️ <strong>Lo siento, la ejecución del experimento ha fallado.</strong></p>
            <p>Ocurrió un error durante la ejecución de los scripts de Python:</p>
            <div style="background-color: #fef2f2; border: 1px solid #fee2e2; border-radius: 8px; padding: 12px; color: #991b1b; font-family: var(--font-mono); font-size: 13px; margin: 10px 0;">
                ${errorMessage}
            </div>
            <p>Por favor, revisa el panel de la consola aquí abajo para ver los logs detallados del error y de la ejecución de Python. Asegúrate de que las API Keys de <code>apis_example.env</code> sean válidas y el formato del Excel sea correcto.</p>
        `);

        chatHistory.push({ role: 'assistant', content: `El experimento falló con el error: ${errorMessage}` });

        resetForm();
    }

    function resetForm() {
        submitBtn.disabled = false;
        submitBtn.querySelector('span').textContent = 'Iniciar Evaluación 🚀';
    }

    // Run session check on load
    checkSession();
});