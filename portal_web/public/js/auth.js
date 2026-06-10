import { state } from './state.js';

export function initAuth({ onLoginSuccess, onLogoutSuccess, applyFrontendLanguage }) {
    const authContainer = document.getElementById('auth-container');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const goToRegister = document.getElementById('go-to-register');
    const goToLogin = document.getElementById('go-to-login');
    const authError = document.getElementById('auth-error');
    const currentUserDisplay = document.getElementById('current-user-display');
    const logoutBtn = document.getElementById('logout-btn');

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

    // Check session on load
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

    function showApp(username, language) {
        authContainer.classList.add('hidden');
        mainApp.classList.remove('hidden');
        currentUserDisplay.textContent = username;
        state.currentUsername = username;
        state.userLanguage = language || 'es';
        
        applyFrontendLanguage(state.userLanguage);
        onLoginSuccess();
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
            onLogoutSuccess();
            showAuth();
            document.getElementById('login-password').value = '';
            document.getElementById('reg-password').value = '';
            document.getElementById('reg-system-key').value = '';
        } catch (err) {
            console.error('Logout failed', err);
        }
    });

    // Update language preference on backend
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

    // Run initial session check
    checkSession();

    return {
        checkSession,
        showAuth,
        showApp,
        updateBackendLanguage
    };
}
