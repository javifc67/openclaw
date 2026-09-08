#!/bin/bash
# ==============================================================================
# Installer / Deployment Script for Psycholinguistics Web Portal & OpenClaw Agent
# ==============================================================================
# This script automates the full setup, including:
# 1. Installing Python dependencies
# 2. Cloning/updating the psycholinguistics_framework
# 3. Installing/Verifying global OpenClaw
# 4. Copying and registering the OpenClaw agent
# 5. Installing the Node.js Web Portal dependencies
# 6. Configuring and launching systemd user-level services
# ==============================================================================

set -e

# Define colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}======================================================================${NC}"
echo -e "  🧠 INSTALACIÓN / DESPLIEGUE DEL PORTAL Y AGENTE PSICOLINGÜÍSTICO   "
echo -e "${BLUE}======================================================================${NC}"

# 1. Determine script directory and home path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORTAL_DIR="$SCRIPT_DIR/portal_web"
AGENT_SOURCE_DIR="$SCRIPT_DIR/agente_openclaw"
HOME_DIR="$HOME"

echo -e "${GREEN}[*] Detectando rutas del sistema...${NC}"
echo -e "    Directorio del script: $SCRIPT_DIR"
echo -e "    Portal Web: $PORTAL_DIR"
echo -e "    Agente origen: $AGENT_SOURCE_DIR"

# Determine sudo command if needed
SUDO=""
if [ "$EUID" -ne 0 ]; then
    if command -v sudo &> /dev/null; then
        SUDO="sudo"
    fi
fi

# 2. Check for node and npm (auto-install if missing)
echo -e "${GREEN}[*] Verificando Node.js y npm...${NC}"
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo -e "${YELLOW}[!] Node.js o npm no detectados. Instalando Node.js 20.x LTS automáticamente...${NC}"
    if command -v apt-get &> /dev/null; then
        $SUDO apt-get update -y
        $SUDO apt-get install -y curl ca-certificates gnupg
        curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
        $SUDO apt-get install -y nodejs
    else
        echo -e "${RED}[ERROR] Gestor de paquetes apt no detectado. Instala Node.js v18+ manualmente.${NC}"
        exit 1
    fi
fi
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "    Node.js: $NODE_VERSION"
echo -e "    npm: $NPM_VERSION"

# 3. Check for Python 3, pip, and zip (auto-install if missing)
echo -e "${GREEN}[*] Verificando Python 3, pip y herramientas del sistema...${NC}"
if ! command -v python3 &> /dev/null || (! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null) || ! command -v zip &> /dev/null; then
    echo -e "${YELLOW}[!] Python 3, pip o zip no detectados. Instalando dependencias del sistema vía apt...${NC}"
    if command -v apt-get &> /dev/null; then
        $SUDO apt-get update -y
        $SUDO apt-get install -y python3 python3-pip python3-venv zip
    else
        echo -e "${RED}[ERROR] No se pudo instalar Python 3 o pip automáticamente. Instálalos antes de continuar.${NC}"
        exit 1
    fi
fi

PYTHON_DEPS="pandas openpyxl pyyaml openai google-genai jsonlines python-dotenv"
echo -e "    Instalando librerías de Python: $PYTHON_DEPS"

# Attempt to install with break-system-packages flag for modern PEP 668 environments
if pip install --user --break-system-packages $PYTHON_DEPS &> /dev/null; then
    echo -e "    Dependencias instaladas con 'pip'."
elif pip3 install --user --break-system-packages $PYTHON_DEPS &> /dev/null; then
    echo -e "    Dependencias instaladas con 'pip3'."
elif pip install --user $PYTHON_DEPS &> /dev/null; then
    echo -e "    Dependencias instaladas con 'pip' (sin break-system-packages)."
elif pip3 install --user $PYTHON_DEPS &> /dev/null; then
    echo -e "    Dependencias instaladas con 'pip3' (sin break-system-packages)."
else
    echo -e "${YELLOW}[!] Fallo de instalación directa del usuario. Probando instalación estándar...${NC}"
    pip install $PYTHON_DEPS || pip3 install $PYTHON_DEPS || {
        echo -e "${RED}[ERROR] No se pudieron instalar las dependencias de Python. Por favor, instálalas manualmente:${NC}"
        echo -e "    pip install $PYTHON_DEPS"
        exit 1
    }
fi

# 4. Clone or update the psycholinguistics_framework
echo -e "${GREEN}[*] Configurando el Framework Psicolingüístico (psycholinguistics_framework)...${NC}"
# Detect Desktop or Escritorio folder
if [ -d "$HOME_DIR/Escritorio" ]; then
    FRAMEWORK_TARGET_DIR="$HOME_DIR/Escritorio/psycholinguistics_framework"
elif [ -d "$HOME_DIR/Desktop" ]; then
    FRAMEWORK_TARGET_DIR="$HOME_DIR/Desktop/psycholinguistics_framework"
else
    FRAMEWORK_TARGET_DIR="$HOME_DIR/psycholinguistics_framework"
fi

if [ -d "$FRAMEWORK_TARGET_DIR" ]; then
    echo -e "    Directorio existente detectado en $FRAMEWORK_TARGET_DIR. Actualizando repositorio..."
    cd "$FRAMEWORK_TARGET_DIR"
    git pull || echo -e "${YELLOW}[!] Advertencia: No se pudo actualizar el framework con git pull. Se utilizará la versión existente.${NC}"
    cd "$SCRIPT_DIR"
else
    echo -e "    Clonando framework en: $FRAMEWORK_TARGET_DIR"
    git clone https://github.com/WordsGPT/psycholinguistics_framework.git "$FRAMEWORK_TARGET_DIR"
fi

# 5. Check and install OpenClaw globally
echo -e "${GREEN}[*] Verificando instalación de OpenClaw...${NC}"
if ! command -v openclaw &> /dev/null; then
    echo -e "    OpenClaw no detectado globalmente. Instalando vía npm..."
    $SUDO npm install -g openclaw || npm install -g openclaw || {
        echo -e "${YELLOW}[!] Advertencia: Error instalando openclaw globalmente. Intentando con npm-global local...${NC}"
        npm install -g openclaw --prefix=~/.npm-global || {
            echo -e "${RED}[ERROR] No se pudo instalar openclaw. Asegúrate de tener permisos para realizar 'npm install -g openclaw'.${NC}"
            exit 1
        }
        export PATH="$HOME/.npm-global/bin:$PATH"
    }
else
    openclaw_bin=$(which openclaw)
    echo -e "    OpenClaw ya está instalado en $openclaw_bin"
fi

# 5.5 Ask the user for Gemini and OpenAI API Keys to streamline setup
echo -e "${YELLOW}🔑 CONFIGURACIÓN DE API KEYS (GEMINI Y OPENAI)${NC}"
echo -e "Para que tanto el Chat de OpenClaw como el Framework de evaluación (Python) funcionen,"
echo -e "es necesario configurar las API Keys correspondientes."
echo -en "Introduce tu Gemini API Key (o presiona Enter para omitir): "
read -r GEMINI_KEY
echo -en "Introduce tu OpenAI API Key (o presiona Enter para omitir): "
read -r OPENAI_KEY
echo ""

# 6. Deploy the Agent workspace and Register it in openclaw.json
echo -e "${GREEN}[*] Desplegando archivos del agente (psycho-agent)...${NC}"
AGENT_TARGET_DIR="$HOME_DIR/.openclaw/agents/psycho-agent"
mkdir -p "$AGENT_TARGET_DIR"
cp -r "$AGENT_SOURCE_DIR"/* "$AGENT_TARGET_DIR/"
echo -e "    Archivos copiados con éxito a $AGENT_TARGET_DIR"

echo -e "    Registrando agente en ~/.openclaw/openclaw.json..."
# Use node helper to safely parse and merge agent inside openclaw.json
GEMINI_KEY="$GEMINI_KEY" OPENAI_KEY="$OPENAI_KEY" node -e '
const fs = require("fs");
const path = require("path");
const home = require("os").homedir();
const configPath = path.join(home, ".openclaw", "openclaw.json");
const geminiKey = process.env.GEMINI_KEY;
const openaiKey = process.env.OPENAI_KEY;

if (!fs.existsSync(configPath)) {
  const initialConfig = {
    "gateway": {
      "mode": "local",
      "auth": {
        "mode": "token",
        "token": require("crypto").randomBytes(24).toString("hex")
      },
      "port": 18789,
      "bind": "lan",
      "controlUi": {
        "allowInsecureAuth": true
      },
      "http": {
        "endpoints": {
          "chatCompletions": {
            "enabled": true
          }
        }
      }
    },
    "agents": {
      "list": [
        {
          "id": "psycho-agent",
          "name": "Evaluador Psicolingüístico",
          "workspace": path.join(home, ".openclaw", "agents", "psycho-agent"),
          "thinkingDefault": "off",
          "model": "google/gemini-3.5-flash"
        }
      ]
    },
    "bindings": [
      {
        "match": {
          "channel": "slack"
        },
        "agentId": "psycho-agent"
      }
    ]
  };

  if (geminiKey && geminiKey.trim() !== "") {
    if (!initialConfig.models) {
      initialConfig.models = { "providers": {} };
    }
    initialConfig.models.providers.google = {
      "api": "google-generative-ai",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "apiKey": geminiKey.trim()
    };
    if (!initialConfig.auth) {
      initialConfig.auth = { "profiles": {} };
    }
    initialConfig.auth.profiles["google:default"] = {
      "provider": "google",
      "mode": "api_key"
    };
  }

  if (openaiKey && openaiKey.trim() !== "") {
    if (!initialConfig.models) {
      initialConfig.models = { "providers": {} };
    }
    initialConfig.models.providers.openai = {
      "api": "openai-completions",
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": openaiKey.trim()
    };
    if (!initialConfig.auth) {
      initialConfig.auth = { "profiles": {} };
    }
    initialConfig.auth.profiles["openai:default"] = {
      "provider": "openai",
      "mode": "api_key"
    };
  }

  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf8");
  console.log("    [OK] Creado nuevo archivo ~/.openclaw/openclaw.json con un token de acceso seguro y chatCompletions habilitado.");
} else {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    console.error("    [ERR] Error al parsear openclaw.json:", err);
    process.exit(1);
  }

  // Ensure gateway configuration and token exist
  if (!config.gateway) {
    config.gateway = {};
  }
  if (!config.gateway.auth) {
    config.gateway.auth = {};
  }
  if (!config.gateway.auth.mode) {
    config.gateway.auth.mode = "token";
  }
  if (!config.gateway.auth.token) {
    config.gateway.auth.token = require("crypto").randomBytes(24).toString("hex");
    console.log("    [OK] Generado un nuevo token de acceso seguro para OpenClaw.");
  }
  if (!config.gateway.port) {
    config.gateway.port = 18789;
  }
  if (!config.gateway.bind || config.gateway.bind === "loopback") {
    config.gateway.bind = "lan";
    console.log("    [OK] Modo de enlace (bind) configurado en 'lan' para permitir acceso desde la red local.");
  }
  if (!config.gateway.controlUi) {
    config.gateway.controlUi = {};
  }
  config.gateway.controlUi.allowInsecureAuth = true;

  // Ensure chatCompletions endpoint is enabled (required for web portal communication)
  if (!config.gateway.http) {
    config.gateway.http = {};
  }
  if (!config.gateway.http.endpoints) {
    config.gateway.http.endpoints = {};
  }
  if (!config.gateway.http.endpoints.chatCompletions) {
    config.gateway.http.endpoints.chatCompletions = {};
  }
  config.gateway.http.endpoints.chatCompletions.enabled = true;
  console.log("    [OK] Asegurado que el endpoint OpenAI-compatible (/v1/chat/completions) está habilitado.");

  // Handle Gemini API Key config if provided
  if (geminiKey && geminiKey.trim() !== "") {
    if (!config.models) {
      config.models = {};
    }
    if (!config.models.providers) {
      config.models.providers = {};
    }
    if (!config.models.providers.google) {
      config.models.providers.google = {
        "api": "google-generative-ai",
        "baseUrl": "https://generativelanguage.googleapis.com/v1beta"
      };
    }
    config.models.providers.google.apiKey = geminiKey.trim();
    console.log("    [OK] Configurado el API Key de Gemini en openclaw.json.");

    // Ensure google auth profile is mapped
    if (!config.auth) {
      config.auth = {};
    }
    if (!config.auth.profiles) {
      config.auth.profiles = {};
    }
    if (!config.auth.profiles["google:default"]) {
      config.auth.profiles["google:default"] = {
        "provider": "google",
        "mode": "api_key"
      };
      console.log("    [OK] Asegurado perfil de autenticación para Google Gemini.");
    }
  }

  // Handle OpenAI API Key config if provided
  if (openaiKey && openaiKey.trim() !== "") {
    if (!config.models) {
      config.models = {};
    }
    if (!config.models.providers) {
      config.models.providers = {};
    }
    if (!config.models.providers.openai) {
      config.models.providers.openai = {
        "api": "openai-completions",
        "baseUrl": "https://api.openai.com/v1"
      };
    }
    config.models.providers.openai.apiKey = openaiKey.trim();
    console.log("    [OK] Configurado el API Key de OpenAI en openclaw.json.");

    // Ensure openai auth profile is mapped
    if (!config.auth) {
      config.auth = {};
    }
    if (!config.auth.profiles) {
      config.auth.profiles = {};
    }
    if (!config.auth.profiles["openai:default"]) {
      config.auth.profiles["openai:default"] = {
        "provider": "openai",
        "mode": "api_key"
      };
      console.log("    [OK] Asegurado perfil de autenticación para OpenAI.");
    }
  }

  let agentList = [];
  let isNested = false;

  if (config.agents && Array.isArray(config.agents.list)) {
    agentList = config.agents.list;
    isNested = true;
  } else if (Array.isArray(config.agents)) {
    agentList = config.agents;
  } else {
    if (!config.agents) config.agents = {};
    config.agents.list = [];
    agentList = config.agents.list;
    isNested = true;
  }

  const hasAgent = agentList.some(a => a.id === "psycho-agent");
  if (!hasAgent) {
    agentList.push({
      "id": "psycho-agent",
      "name": "Evaluador Psicolingüístico",
      "workspace": path.join(home, ".openclaw", "agents", "psycho-agent"),
      "thinkingDefault": "off",
      "model": "google/gemini-3.5-flash"
    });
    console.log("    [OK] Agregado psycho-agent a la lista de agentes.");
  } else {
    // Update existing psycho-agent workspace to the ~/.openclaw/agents/psycho-agent folder and ensure it uses Gemini
    const idx = agentList.findIndex(a => a.id === "psycho-agent");
    agentList[idx].workspace = path.join(home, ".openclaw", "agents", "psycho-agent");
    agentList[idx].model = "google/gemini-3.5-flash";
    console.log("    [OK] El agente psycho-agent ya estaba registrado. Ruta de espacio de trabajo y modelo (Gemini) actualizados.");
  }

  // Ensure bindings array exists and slack is bound to psycho-agent
  if (!config.bindings) {
    config.bindings = [];
  }
  const hasSlackBinding = config.bindings.some(b => b.match && b.match.channel === "slack" && b.agentId === "psycho-agent");
  if (!hasSlackBinding) {
    config.bindings.push({
      "match": {
        "channel": "slack"
      },
      "agentId": "psycho-agent"
    });
    console.log("    [OK] Añadida vinculación de Slack para psycho-agent.");
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8");
}
'

# 6.5 Config .env in psycholinguistics_framework
if [ -n "$GEMINI_KEY" ] || [ -n "$OPENAI_KEY" ]; then
    echo -e "${GREEN}[*] Configurando archivo .env en el Framework Psicolingüístico...${NC}"
    echo "GEMINI_API_KEY=\"$GEMINI_KEY\"" > "$FRAMEWORK_TARGET_DIR/.env"
    echo "OPENAI_API_KEY=\"$OPENAI_KEY\"" >> "$FRAMEWORK_TARGET_DIR/.env"
    echo -e "    [OK] Archivo .env configurado con éxito en $FRAMEWORK_TARGET_DIR/.env"
fi

# 7. Install Web Portal dependencies
echo -e "${GREEN}[*] Instalando dependencias de la Web Portal...${NC}"
cd "$PORTAL_DIR"
npm install
cd "$SCRIPT_DIR"

# 8. Configure Systemd services
echo -e "${GREEN}[*] Configurando servicios Systemd para persistencia...${NC}"

# Configure systemd user lingering to survive SSH logout
if command -v loginctl &> /dev/null; then
    echo -e "    Asegurando persistencia tras cierre de sesión (loginctl enable-linger)..."
    $SUDO loginctl enable-linger "$USER" 2>/dev/null || loginctl enable-linger "$USER" 2>/dev/null || true
fi

# Check and open ufw ports if ufw is active
if command -v ufw &> /dev/null; then
    if $SUDO ufw status 2>/dev/null | grep -q "Status: active"; then
        echo -e "    Firewall ufw activo detectado. Abriendo puertos 3000 y 18789..."
        $SUDO ufw allow 3000/tcp 2>/dev/null || true
        $SUDO ufw allow 18789/tcp 2>/dev/null || true
    fi
fi

SYSTEMD_USER_DIR="$HOME_DIR/.config/systemd/user"
mkdir -p "$SYSTEMD_USER_DIR"

# Copy service files
cp "$SCRIPT_DIR/templates/openclaw-gateway.service" "$SYSTEMD_USER_DIR/"
cp "$SCRIPT_DIR/templates/psycholinguistics-portal.service" "$SYSTEMD_USER_DIR/"

# Replace WorkingDirectory in portal service with current absolute path
PORTAL_WEB_DIR="$(readlink -f "$PORTAL_DIR")"
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$PORTAL_WEB_DIR|g" "$SYSTEMD_USER_DIR/psycholinguistics-portal.service"

echo -e "    Servicios copiados y rutas ajustadas."

# Reload, enable and start services
echo -e "    Recargando systemd user daemon, habilitando e iniciando servicios..."
systemctl --user daemon-reload
systemctl --user enable openclaw-gateway.service
systemctl --user enable psycholinguistics-portal.service

systemctl --user restart openclaw-gateway.service
systemctl --user restart psycholinguistics-portal.service

# Verify status briefly
sleep 2
GATEWAY_STATUS=$(systemctl --user is-active openclaw-gateway.service || echo "inactive")
PORTAL_STATUS=$(systemctl --user is-active psycholinguistics-portal.service || echo "inactive")

echo -e "${BLUE}======================================================================${NC}"
echo -e "  🎉 ¡DESPLIEGUE COMPLETADO CON ÉXITO!                               "
echo -e "${BLUE}======================================================================${NC}"
echo -e "  Estado de los servicios:"
if [ "$GATEWAY_STATUS" = "active" ]; then
    echo -e "    - OpenClaw Gateway: ${GREEN}ACTIVO / EN EJECUCIÓN${NC}"
else
    echo -e "    - OpenClaw Gateway: ${RED}INACTIVO / ERROR${NC} (Verifica con: systemctl --user status openclaw-gateway.service)"
fi

if [ "$PORTAL_STATUS" = "active" ]; then
    echo -e "    - Portal Web:       ${GREEN}ACTIVO / EN EJECUCIÓN${NC}"
else
    echo -e "    - Portal Web:       ${RED}INACTIVO / ERROR${NC} (Verifica con: systemctl --user status psycholinguistics-portal.service)"
fi

# Extract OpenClaw gateway token and primary IP
OPENCLAW_TOKEN=$(node -e 'try { const c = JSON.parse(require("fs").readFileSync(require("path").join(require("os").homedir(), ".openclaw", "openclaw.json"), "utf8")); console.log(c.gateway?.auth?.token || ""); } catch (_) { console.log(""); }')
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
[ -z "$SERVER_IP" ] && SERVER_IP="<IP_DE_LA_VM>"

echo -e ""
echo -e "  🌍 Portal de Evaluación Psicolingüística:"
echo -e "     - Local:  ${GREEN}http://localhost:3000${NC}"
echo -e "     - En red: ${GREEN}http://${SERVER_IP}:3000${NC}"
echo -e ""
echo -e "  ⚙️  Panel de Control / Puente de OpenClaw:"
echo -e "     - Local:  ${GREEN}http://localhost:18789/?token=${OPENCLAW_TOKEN}${NC}"
echo -e "     - En red: ${GREEN}http://${SERVER_IP}:18789/?token=${OPENCLAW_TOKEN}${NC}"
echo -e ""
echo -e "  📜 Comandos útiles de monitorización (Logs):"
echo -e "     - Ver logs del Portal:  ${YELLOW}journalctl --user -u psycholinguistics-portal.service -f${NC}"
echo -e "     - Ver logs de OpenClaw: ${YELLOW}journalctl --user -u openclaw-gateway.service -f${NC}"
echo -e "${BLUE}======================================================================${NC}"
