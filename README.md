# Psycholinguistics Evaluation Web Portal & OpenClaw Agent Deployment

This repository contains the complete configuration and code necessary to replicate and deploy the **Psycholinguistics Evaluation Web Portal** along with its specialized **OpenClaw Agent** (`psycho-agent`) on a new machine.

---

## Architecture Overview

The system consists of two major decoupled components running on the same host:

1. **Psycholinguistics Web Portal (`portal_web/`):**
   A Node.js web application running on port `3000`. It provides a clean, secure chat-based and dashboard interface for users to register, upload datasets, configure experiments, run evaluations, and download zipped results.
   
2. **OpenClaw Agent (`agente_openclaw/`):**
   The conversational artificial intelligence engine configured to control the underlying python psycholinguistics evaluation scripts, monitor batch runs, and generate/compile results. It runs under OpenClaw on port `18789`.

---

## Prerequisites

Before starting the deployment, make sure the following dependencies are installed on the target machine:

### 1. Node.js & npm
Node.js (v18.0.0 or higher) is required to run both OpenClaw and the web portal.
- [Install Node.js on Linux](https://nodejs.org/en/download/package-manager)

### 2. Python 3 & Required Libraries
Python 3.10+ is required to execute the evaluation scripts. Install the required packages globally or in user space:
```bash
pip install pandas openpyxl pyyaml openai google-genai jsonlines python-dotenv
# Note: If running on Debian/Ubuntu, you may need to use `--break-system-packages` if installing globally.
```

### 3. OpenClaw
OpenClaw is the framework that manages the agent. Install OpenClaw globally:
```bash
npm install -g openclaw
```

---

## Step-by-Step Deployment Guide

Follow these steps to deploy the portal on your new server or workstation:

### Step 1: Clone the Repository
Clone this deployment repository to your desired path on the target machine:
```bash
git clone <your-repository-url> ~/Escritorio/psycholinguistics_deployment
cd ~/Escritorio/psycholinguistics_deployment
```

### Step 2: Install Portal Dependencies
Navigate to the web portal directory and install the required npm packages:
```bash
cd portal_web
npm install
cd ..
```

### Step 3: Register and Configure the OpenClaw Agent
OpenClaw expects agent configurations under the `~/.openclaw/agents/` directory.

1. **Create the agent folder structure:**
   ```bash
   mkdir -p ~/.openclaw/agents/psycho-agent
   ```
2. **Copy the agent files** from the deployment repository to your active OpenClaw directory:
   ```bash
   cp -r agente_openclaw/* ~/.openclaw/agents/psycho-agent/
   ```
3. **Register the agent** inside your global `~/.openclaw/openclaw.json` configuration file. Open the file and append the following agent block to the `"agents"` array (you can find a complete JSON template in `templates/openclaw-agent-config.json`):
   ```json
   {
     "id": "psycho-agent",
     "name": "Evaluador Psicolingüístico",
     "workspace": "/home/YOUR_USERNAME/.openclaw/agents/psycho-agent",
     "thinkingDefault": "off"
   }
   ```
   *(Be sure to replace `/home/YOUR_USERNAME` with your actual home directory path).*

---

## Running & Managing Services

To ensure both OpenClaw and the Web Portal run continuously in the background and survive machine restarts, we use Systemd user-level services.

### Step 1: Configure Service Templates
We have provided systemd service templates in the `templates/` folder:
- `openclaw-gateway.service`
- `psycholinguistics-portal.service`

Copy these template files into your local systemd config directory:
```bash
mkdir -p ~/.config/systemd/user/
cp templates/*.service ~/.config/systemd/user/
```

### Step 2: Customize Path Values
Open and edit the copied service files to ensure they point to the correct absolute paths of your new machine's home directory:

1. **Verify `~/.config/systemd/user/openclaw-gateway.service`** (specifically check that the node binary and home variables point to your username path).
2. **Verify `~/.config/systemd/user/psycholinguistics-portal.service`** (ensure `WorkingDirectory`, `ExecStart`, and log paths match your repository directory).

### Step 3: Enable and Start Services
Run the following commands to reload systemd, enable automatic startup on boot, and spin up the services:

```bash
# Reload user-space systemd configurations
systemctl --user daemon-reload

# Enable automatic startup on boot
systemctl --user enable openclaw-gateway.service
systemctl --user enable psycholinguistics-portal.service

# Start services right now
systemctl --user start openclaw-gateway.service
systemctl --user start psycholinguistics-portal.service
```

### Step 4: Verify Service Status
To confirm that both services started successfully and are running without errors, check their status:

```bash
# Check OpenClaw Gateway Status
systemctl --user status openclaw-gateway.service

# Check Web Portal Status
systemctl --user status psycholinguistics-portal.service
```

Logs are actively appended to `portal_web/server.log` for the portal, and standard journalctl logs can be accessed with:
```bash
journalctl --user -u psycholinguistics-portal.service -f
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
