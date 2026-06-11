import { translations } from './js/translations.js';
import { state } from './js/state.js';
import { initAuth } from './js/auth.js';
import { initChat } from './js/chat.js';
import { initExperiment } from './js/experiment.js';

document.addEventListener('DOMContentLoaded', () => {
    // Shared Elements
    const authLangSelect = document.getElementById('auth-lang-select');
    const appLangSelect = document.getElementById('app-lang-select');
    const clearChatBtn = document.getElementById('clear-chat');
    const attachBtn = document.getElementById('attach-btn');
    const chatInput = document.getElementById('chat-input');
    const sendChatBtn = document.getElementById('send-chat-btn');
    const toggleConsole = document.getElementById('toggle-console');
    const consoleDrawer = document.getElementById('console-drawer');

    // Initialize Submodules
    const chatModule = initChat({
        showAuth: () => authModule.showAuth()
    });

    const experimentModule = initExperiment({
        showAuth: () => authModule.showAuth()
    });

    const authModule = initAuth({
        onLoginSuccess: () => {
            chatModule.loadHistory();
            chatModule.startPolling();
        },
        onLogoutSuccess: () => {
            chatModule.stopPolling();
            if (state.eventSource) {
                state.eventSource.close();
            }
        },
        applyFrontendLanguage: (lang) => {
            applyFrontendLanguage(lang);
        }
    });

    // Apply translations and update dropdowns
    function applyFrontendLanguage(lang) {
        state.userLanguage = lang;
        
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

        const goToRegister = document.getElementById('go-to-register');
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

        const goToLogin = document.getElementById('go-to-login');
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

        if (sendChatBtn) sendChatBtn.textContent = t.sendBtn;

        if (toggleConsole) toggleConsole.querySelector('span').textContent = t.consoleTitle;
    }

    // Set up language selector event listeners
    if (authLangSelect) {
        authLangSelect.addEventListener('change', (e) => {
            const selectedLang = e.target.value;
            applyFrontendLanguage(selectedLang);
            
            const regLanguageSelect = document.getElementById('reg-language');
            if (regLanguageSelect) regLanguageSelect.value = selectedLang;
        });
    }

    if (appLangSelect) {
        appLangSelect.addEventListener('change', (e) => {
            const selectedLang = e.target.value;
            applyFrontendLanguage(selectedLang);
            authModule.updateBackendLanguage(selectedLang);
            
            if (state.chatHistory.length === 1 && state.chatHistory[0].role === 'assistant') {
                chatModule.showWelcomeMessage();
            }
        });
    }

    // Toggle Console Drawer height
    if (toggleConsole && consoleDrawer) {
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
    }
});
