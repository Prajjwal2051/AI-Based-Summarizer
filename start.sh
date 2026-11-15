#!/usr/bin/env bash

# Resolve project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ANSI Color & Formatting Codes
BOLD="\033[1m"
DIM="\033[2m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RED="\033[31m"
BLUE="\033[34m"
MAGENTA="\033[35m"
RESET="\033[0m"

clear 2>/dev/null || true

echo -e "${BOLD}${CYAN}========================================================================${RESET}"
echo -e "${BOLD}${CYAN}   🧠 RAG Information AI Agent — Interactive Launcher${RESET}"
echo -e "${DIM}   Multimodal Knowledge Retrieval • YouTube • Web • PDF • Notes${RESET}"
echo -e "${BOLD}${CYAN}========================================================================${RESET}"
echo ""

# 1. Virtual Environment Check & Creation
echo -e "${BOLD}[1/4] Checking Python Virtual Environment...${RESET}"
VENV_DIR="$SCRIPT_DIR/venv"

if [ ! -d "$VENV_DIR" ]; then
    echo -e "  ${YELLOW}⚡ Virtual environment not found. Creating ./venv ...${RESET}"
    python3 -m venv "$VENV_DIR"
    echo -e "  ${GREEN}✓ Created clean virtual environment in ./venv${RESET}"
    NEED_INSTALL=true
else
    echo -e "  ${GREEN}✓ Found virtual environment:${RESET} ${DIM}$VENV_DIR${RESET}"
    NEED_INSTALL=false
fi

# Activate venv
source "$VENV_DIR/bin/activate"

# 2. Check Pip Dependencies
echo ""
echo -e "${BOLD}[2/4] Verifying Python Dependencies...${RESET}"
MISSING_PKGS=$(python -c '
required = [
    "fastapi", "uvicorn", "langchain", "langchain_community",
    "langchain_core", "langchain_ollama", "langchain_text_splitters",
    "faiss", "youtube_transcript_api", "bs4", "requests",
    "pypdf", "dotenv", "pydantic"
]
missing = []
for pkg in required:
    try:
        __import__(pkg)
    except ImportError:
        missing.append(pkg)
if missing:
    print(", ".join(missing))
' 2>/dev/null || echo "check_error")

if [ -n "$MISSING_PKGS" ] || [ "$NEED_INSTALL" = true ]; then
    echo -e "  ${YELLOW}⚠️  Missing or incomplete packages detected (${MISSING_PKGS:-all}).${RESET}"
    echo -e "  ${CYAN}📦 Installing dependencies from requirements.txt...${RESET}"
    pip install --upgrade pip > /dev/null 2>&1 || true
    pip install -r "$SCRIPT_DIR/requirements.txt"
    echo -e "  ${GREEN}✓ All Python packages verified & installed successfully.${RESET}"
else
    echo -e "  ${GREEN}✓ All required Python modules installed and ready.${RESET}"
fi

# 3. Check Ollama Status
echo ""
echo -e "${BOLD}[3/4] Verifying Local Ollama Engine...${RESET}"
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "  ${YELLOW}⚠️  Ollama daemon is not responding on http://localhost:11434.${RESET}"
    echo -e "  ${CYAN}Starting Ollama in background...${RESET}"
    if command -v ollama >/dev/null 2>&1; then
        ollama serve > /dev/null 2>&1 &
        sleep 2
    elif [ -d "/Applications/Ollama.app" ]; then
        open -a Ollama
        sleep 3
    else
        echo -e "  ${RED}❌ Ollama not found! Please download from https://ollama.com${RESET}"
    fi
fi

# Verify models
MODELS_JSON=$(curl -s http://localhost:11434/api/tags 2>/dev/null || echo "{}")
ACTIVE_MODEL=$(grep -E '^OLLAMA_MODEL=' .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "gemma2:2b")
ACTIVE_EMBED=$(grep -E '^OLLAMA_EMBED_MODEL=' .env 2>/dev/null | cut -d '=' -f2 | tr -d '"' | tr -d "'" || echo "embeddinggemma")

echo -e "  ${GREEN}✓ Ollama is online!${RESET}"
echo -e "    ${DIM}• Active Chat LLM:${RESET}    ${BOLD}${MAGENTA}${ACTIVE_MODEL:-gemma2:2b}${RESET}"
echo -e "    ${DIM}• Active Embedding:${RESET}   ${BOLD}${BLUE}${ACTIVE_EMBED:-embeddinggemma}${RESET}"

# 4. Frontend Assets Check
echo ""
echo -e "${BOLD}[4/4] Verifying Frontend Assets...${RESET}"
if [ ! -d "$SCRIPT_DIR/frontend/dist" ]; then
    echo -e "  ${YELLOW}⚡ Building React frontend (production bundle)...${RESET}"
    (cd "$SCRIPT_DIR/frontend" && npm install >/dev/null 2>&1 && npm run build)
    echo -e "  ${GREEN}✓ Frontend built successfully into frontend/dist/${RESET}"
else
    echo -e "  ${GREEN}✓ Production frontend build is ready.${RESET}"
fi

echo ""
echo -e "${BOLD}${CYAN}------------------------------------------------------------------------${RESET}"
echo -e "${BOLD}Select how you want to launch:${RESET}"
echo -e "  ${BOLD}[1]${RESET} ${GREEN}Web Application${RESET} (FastAPI Backend + Notion-style React UI at http://localhost:8000)"
echo -e "  ${BOLD}[2]${RESET} ${CYAN}Development Mode${RESET} (FastAPI on :8000 + Vite Hot-Reload on :5173)"
echo -e "  ${BOLD}[3]${RESET} ${MAGENTA}Terminal CLI Demo${RESET} (Quick YouTube Ingest & RAG question in terminal)"
echo -e "  ${BOLD}[4]${RESET} ${BLUE}Run Test Suite${RESET} (Execute backend integration tests)"
echo -e "  ${BOLD}[5]${RESET} ${YELLOW}Exit${RESET}"
echo -e "${BOLD}${CYAN}------------------------------------------------------------------------${RESET}"

# Prompt with a 7-second countdown default to [1]
echo -e "${DIM}Auto-starting Option [1] in 7 seconds (or press 1-5 now)...${RESET}"
read -t 7 -p "Enter choice [1-5] (default: 1): " USER_CHOICE || USER_CHOICE="1"
echo ""

case "$USER_CHOICE" in
    2)
        echo -e "${BOLD}${CYAN}Starting Development Mode with Vite Live Reload...${RESET}"
        ./start-dev.sh
        ;;
    3)
        echo -e "${BOLD}${MAGENTA}Running Terminal CLI Demo...${RESET}"
        python main.py
        ;;
    4)
        echo -e "${BOLD}${BLUE}Running Integration Test Suite...${RESET}"
        python tests/test_backend.py
        ;;
    5)
        echo -e "${YELLOW}Exiting.${RESET}"
        exit 0
        ;;
    *)
        echo -e "${BOLD}${GREEN}========================================================================${RESET}"
        echo -e "${BOLD}${GREEN}  🚀 Server launching at: http://localhost:8000${RESET}"
        echo -e "  ${DIM}Opening your browser automatically...${RESET}"
        echo -e "  ${DIM}Press ${BOLD}Ctrl+C${RESET}${DIM} to stop the server anytime.${RESET}"
        echo -e "${BOLD}${GREEN}========================================================================${RESET}"
        echo ""

        # Open browser automatically after 1.5s
        (sleep 1.5 && open "http://localhost:8000" > /dev/null 2>&1 || true) &

        # Launch production server
        python main.py --serve
        ;;
esac
