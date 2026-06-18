#!/bin/bash
set -e

# Ensure OpenClaw state directory exists
mkdir -p /root/.openclaw

# If the config file does not exist, initialize the directory
if [ ! -f "/root/.openclaw/openclaw.json" ]; then
  echo "[ENTRYPOINT] First-time initialization of OpenClaw state directory..."
  mkdir -p /root/.openclaw/agents/psycho-agent
  
  # Copy default agent files (workspace files)
  cp -r /app/default_agent/* /root/.openclaw/agents/psycho-agent/
  
  # Copy default global config
  mkdir -p /root/.openclaw/gateway
  cp /app/default_config/openclaw.json /root/.openclaw/openclaw.json
  
  # Replace home directory template with the root directory of the container
  sed -i 's|/home/YOUR_USERNAME|/root|g' /root/.openclaw/openclaw.json
  
  # Generate a random auth token for this user's OpenClaw instance
  TOKEN=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
  # Replace token placeholder in openclaw.json
  sed -i "s/\"token\": null/\"token\": \"$TOKEN\"/g" /root/.openclaw/openclaw.json
  echo "[ENTRYPOINT] OpenClaw initialized with a fresh secure token."
else
  echo "[ENTRYPOINT] OpenClaw state directory already exists. Skipping initialization."
fi

# Start the OpenClaw Gateway
echo "[ENTRYPOINT] Starting OpenClaw Gateway on port 18789..."
# We bind to 'lan' (0.0.0.0) so the host can communicate with this container's port
exec openclaw gateway run --port 18789 --bind lan --force
