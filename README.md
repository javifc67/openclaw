# Psycholinguistics Evaluation Web Portal & OpenClaw Agent Deployment

This repository contains the complete configuration and code necessary to replicate and deploy the **Psycholinguistics Evaluation Web Portal** along with its specialized **OpenClaw Agent** (`psycho-agent`) on a new machine.

Now with a **fully automated setup script** (`setup.sh`) that installs Python dependencies, clones the psycholinguistics framework, registers the agent in OpenClaw, installs npm dependencies, and sets up Systemd services!

---

## Architecture Overview

The system consists of two major decoupled components running on the same host:

1. **Psycholinguistics Web Portal (`portal_web/`):**
   A Node.js web application running on port `3000`. It provides a clean, secure chat-based and dashboard interface for users to register, upload datasets, configure experiments, run evaluations, and download zipped results.
   
2. **OpenClaw Agent (`agente_openclaw/`):**
   The conversational artificial intelligence engine configured to control the underlying python psycholinguistics evaluation scripts, monitor batch runs, and generate/compile results. It runs under OpenClaw on port `18789`.

---

## ⚡ Quick Start: Automated Deployment (Recommended)

To deploy everything in a single step, just run the automated setup script on the target machine:

```bash
# 1. Clone this deployment repository to your desired path
cd ~/Escritorio # or ~/Desktop
git clone https://github.com/javifc67/openclaw.git psycholinguistics_deployment
cd psycholinguistics_deployment

# 2. Run the installer script
./setup.sh
```

### What does `setup.sh` do?
1. **Verifies system environment:** Checks if Node.js, npm, and Python 3 are present.
2. **Installs Python Libraries:** Automatically installs `pandas`, `openpyxl`, `pyyaml`, `openai`, `google-genai`, `jsonlines`, and `python-dotenv` in the user space (compatible with modern PEP 668 environments).
3. **Configures API Keys:** Prompts the user to enter their Gemini API Key once, and automatically configures it in both OpenClaw (`openclaw.json`) and the Python Framework (`.env`).
4. **Clones/Updates the Framework:** Automatically downloads the latest version of the core `psycholinguistics_framework` repository to your desktop/home directory.
5. **Deploys and Registers the Agent:** Moves agent files to `~/.openclaw/agents/psycho-agent` and edits `~/.openclaw/openclaw.json` automatically.
6. **Installs Web Portal Packages:** Runs `npm install` inside the web portal.
7. **Configures and Starts Systemd Services:** Sets up `openclaw-gateway.service` and `psycholinguistics-portal.service` as user services, customizes the exact paths, and starts/enables them so they survive restarts!

---

## Manual Step-by-Step Deployment Guide

If you prefer to configure components manually, follow these steps instead:

### Step 1: Install Prerequisites
Make sure the following dependencies are installed:
- **Node.js (v18.0.0 or higher)** & **npm**
- **Python 3.10+** and required libraries:
  ```bash
  pip install --user --break-system-packages pandas openpyxl pyyaml openai google-genai jsonlines python-dotenv
  ```
- **OpenClaw** (globally):
  ```bash
  npm install -g openclaw
  ```

### Step 2: Clone the Repositories
```bash
# Clone Core Framework
git clone https://github.com/WordsGPT/psycholinguistics_framework.git ~/Escritorio/psycholinguistics_framework

# Clone Web Portal & Agent Deployment
git clone https://github.com/javifc67/openclaw.git ~/Escritorio/psycholinguistics_deployment
```

### Step 3: Install Portal Dependencies
```bash
cd ~/Escritorio/psycholinguistics_deployment/portal_web
npm install
```

### Step 4: Register the OpenClaw Agent
1. **Create the agent folder structure:**
   ```bash
   mkdir -p ~/.openclaw/agents/psycho-agent
   ```
2. **Copy the agent files:**
   ```bash
   cp -r ~/Escritorio/psycholinguistics_deployment/agente_openclaw/* ~/.openclaw/agents/psycho-agent/
   ```
3. **Register the agent** inside your global `~/.openclaw/openclaw.json` config. Append this block to your `"agents"` or `"agents.list"` array (see `templates/openclaw-agent-config.json`):
   ```json
   {
     "id": "psycho-agent",
     "name": "Evaluador Psicolingüístico",
     "workspace": "/home/YOUR_USERNAME/.openclaw/agents/psycho-agent",
     "thinkingDefault": "off"
   }
   ```

### Step 5: Configure & Launch Services (Systemd)
Copy the service files and configure absolute paths:
```bash
mkdir -p ~/.config/systemd/user/
cp templates/*.service ~/.config/systemd/user/

# Edit ~/.config/systemd/user/psycholinguistics-portal.service 
# and set WorkingDirectory to your absolute portal_web folder path.

# Reload and Start:
systemctl --user daemon-reload
systemctl --user enable openclaw-gateway.service
systemctl --user enable psycholinguistics-portal.service
systemctl --user start openclaw-gateway.service
systemctl --user start psycholinguistics-portal.service
```

---

## Running & Monitoring

### Accessing the Web Portal
Open your web browser and navigate to:
- Locally: 👉 **`http://localhost:3000`**
- Over LAN / Server: 👉 **`http://<SERVER_IP>:3000`**

### Accessing the OpenClaw Control Panel (Dashboard / Bridge)
To monitor agents, modify LLM providers, and adjust system settings from your browser:
- Locally: 👉 **`http://localhost:18789/?token=<YOUR_TOKEN>`**
- Over LAN / Server: 👉 **`http://<SERVER_IP>:18789/?token=<YOUR_TOKEN>`**

> **Tip:** You can check your gateway access token by running `openclaw dashboard --no-open` or reading `gateway.auth.token` in `~/.openclaw/openclaw.json`.

### Viewing Logs (Troubleshooting)
```bash
# View Web Portal live logs
journalctl --user -u psycholinguistics-portal.service -f

# View OpenClaw Gateway live logs
journalctl --user -u openclaw-gateway.service -f
```

---

## Security & API Credentials

This repository is **100% secure** and pre-configured to keep API keys hidden:

- **No Secrets in Git:** All log files, session histories, user databases (`users.json`), and `.env` credentials are ignored globally by `.gitignore`.
- **System-wide integration:** The portal automatically loads configuration and auth tokens directly from `~/.openclaw/openclaw.json` at startup, avoiding any duplicate key files.
- **Python credential sandbox:** The agent temporarily creates sandboxed `apis.env` credentials for python executions and automatically deletes them after compiling the results to ensure total server security.

---

## License & Citation
Designed and developed for the UPM Research Department (2026).
For support, contact Javi or check the central OpenClaw documentation.
