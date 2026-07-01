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

# 2. Check for node and npm
echo -e "${GREEN}[*] Verificando Node.js y npm...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}[ERROR] Node.js no está instalado. Instálalo antes de continuar.${NC}"
    exit 1
fi
if ! command -v npm &> /dev/null; then
    echo -e "${RED}[ERROR] npm no está instalado. Instálalo antes de continuar.${NC}"
    exit 1
fi
NODE_VERSION=$(node -v)
NPM_VERSION=$(npm -v)
echo -e "    Node.js: $NODE_VERSION"
echo -e "    npm: $NPM_VERSION"

# 3. Check for Python 3 and install framework python dependencies
echo -e "${GREEN}[*] Verificando Python y dependencias necesarias...${NC}"
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}[ERROR] Python 3 no está instalado. Instálalo antes de continuar.${NC}"
    exit 1
fi
if ! command -v pip &> /dev/null && ! command -v pip3 &> /dev/null; then
    echo -e "${RED}[ERROR] pip/pip3 no está instalado. Instálalo antes de continuar.${NC}"
    exit 1
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
    npm install -g openclaw || {
        echo -e "${YELLOW}[!] Advertencia: Error instalando openclaw globalmente. Intentando con npm-global local...${NC}"
        npm install -g openclaw --prefix=~/.npm-global || {
            echo -e "${RED}[ERROR] No se pudo instalar openclaw. Asegúrate de tener permisos para realizar 'npm install -g openclaw'.${NC}"
            exit 1
        }
    }
else
    echo -e "    OpenClaw ya está instalado en $(which openclaw)"
fi

# 6. Deploy the Agent workspace and Register it in openclaw.json
echo -e "${GREEN}[*] Desplegando archivos del agente (psycho-agent)...${NC}"
AGENT_TARGET_DIR="$HOME_DIR/.openclaw/agents/psycho-agent"
mkdir -p "$AGENT_TARGET_DIR"
cp -r "$AGENT_SOURCE_DIR"/* "$AGENT_TARGET_DIR/"
echo -e "    Archivos copiados con éxito a $AGENT_TARGET_DIR"

echo -e "    Registrando agente en ~/.openclaw/openclaw.json..."
# Use node helper to safely parse and merge agent inside openclaw.json
node -e '
const fs = require("fs");
const path = require("path");
const home = require("os").homedir();
const configPath = path.join(home, ".openclaw", "openclaw.json");

if (!fs.existsSync(configPath)) {
  const initialConfig = {
    "agents": {
      "list": [
        {
          "id": "psycho-agent",
          "name": "Evaluador Psicolingüístico",
          "workspace": path.join(home, ".openclaw", "agents", "psycho-agent"),
          "thinkingDefault": "off"
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
  fs.mkdirSync(path.dirname(configPath), { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(initialConfig, null, 2), "utf8");
  console.log("    [OK] Creado nuevo archivo ~/.openclaw/openclaw.json");
} else {
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  } catch (err) {
    console.error("    [ERR] Error al parsear openclaw.json:", err);
    process.exit(1);
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
      "thinkingDefault": "off"
    });
    console.log("    [OK] Agregado psycho-agent a la lista de agentes.");
  } else {
    // Update existing psycho-agent workspace to the ~/.openclaw/agents/psycho-agent folder
    const idx = agentList.findIndex(a => a.id === "psycho-agent");
    agentList[idx].workspace = path.join(home, ".openclaw", "agents", "psycho-agent");
    console.log("    [OK] El agente psycho-agent ya estaba registrado. Ruta de espacio de trabajo actualizada.");
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

# 7. Install Web Portal dependencies
echo -e "${GREEN}[*] Instalando dependencias de la Web Portal...${NC}"
cd "$PORTAL_DIR"
npm install
cd "$SCRIPT_DIR"

# 8. Configure Systemd services
echo -e "${GREEN}[*] Configurando servicios Systemd para persistencia...${NC}"
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

echo -e ""
echo -e "  🌍 Puedes acceder al Portal de Evaluación Psicolingüística en:"
echo -e "     ${GREEN}http://localhost:3000${NC}"
echo -e ""
echo -e "  📜 Comandos útiles de monitorización (Logs):"
echo -e "     - Ver logs del Portal:  ${YELLOW}journalctl --user -u psycholinguistics-portal.service -f${NC}"
echo -e "     - Ver logs de OpenClaw: ${YELLOW}journalctl --user -u openclaw-gateway.service -f${NC}"
echo -e "${BLUE}======================================================================${NC}"
