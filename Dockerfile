FROM node:20-bookworm

# Install Python 3, pip, zip and utilities
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    zip \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies in user space (break system packages is required on Bookworm for global pip)
RUN pip3 install --break-system-packages pandas openpyxl pyyaml openai google-genai jsonlines python-dotenv

# Install OpenClaw globally
RUN npm install -g openclaw

# Set working directory
WORKDIR /app

# Copy default agent template and global config template
COPY agente_openclaw /app/default_agent
COPY templates/openclaw-agent-config.json /app/default_config/openclaw.json

# Copy entrypoint script
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh

# Expose the default OpenClaw gateway port inside the container
EXPOSE 18789

# Set entrypoint
ENTRYPOINT ["/app/entrypoint.sh"]
