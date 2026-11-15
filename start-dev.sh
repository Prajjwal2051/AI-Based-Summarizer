#!/usr/bin/env bash

# Resolve project directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ANSI Colors
BOLD="\033[1m"
DIM="\033[2m"
CYAN="\033[36m"
GREEN="\033[32m"
YELLOW="\033[33m"
RESET="\033[0m"

echo -e "${BOLD}${CYAN}========================================================================${RESET}"
echo -e "${BOLD}${CYAN}  🛠️  RAG Information Agent — Development Mode (Live Hot-Reload)${RESET}"
echo -e "${BOLD}${CYAN}========================================================================${RESET}"

# Check & activate venv
if [ -d "$SCRIPT_DIR/venv" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
elif [ -d "$SCRIPT_DIR/../langChainModels/venv" ]; then
    source "$SCRIPT_DIR/../langChainModels/venv/bin/activate"
else
    echo -e "${YELLOW}Creating virtual environment in ./venv ...${RESET}"
    python3 -m venv "$SCRIPT_DIR/venv"
    source "$SCRIPT_DIR/venv/bin/activate"
    pip install -r requirements.txt
fi

# Ensure frontend dependencies are installed
if [ ! -d "$SCRIPT_DIR/frontend/node_modules" ]; then
    echo -e "${CYAN}Installing frontend dependencies...${RESET}"
    (cd "$SCRIPT_DIR/frontend" && npm install)
fi

# Trap to gracefully shut down both processes on Ctrl+C
cleanup() {
    echo ""
    echo -e "${YELLOW}Shutting down development servers...${RESET}"
    kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Start Python Backend on port 8000
echo -e "${GREEN}✓ Starting FastAPI backend on http://localhost:8000 ...${RESET}"
python main.py --serve --port 8000 &
BACKEND_PID=$!

# Wait briefly for backend
sleep 1.5

# 2. Start Vite Frontend on port 5173
echo -e "${CYAN}✓ Starting Vite frontend on http://localhost:5173 ...${RESET}"
(cd "$SCRIPT_DIR/frontend" && npm run dev) &
FRONTEND_PID=$!

# Automatically open browser
(sleep 2 && open "http://localhost:5173" > /dev/null 2>&1 || true) &

echo ""
echo -e "${BOLD}${GREEN}========================================================================${RESET}"
echo -e "${BOLD}${GREEN}  🎉 Dev Environment Running!${RESET}"
echo -e "  • ${BOLD}Frontend UI:${RESET}  http://localhost:5173 (Vite Hot-Reload)"
echo -e "  • ${BOLD}Backend API:${RESET}  http://localhost:8000 (FastAPI Docs at /docs)"
echo -e "  ${DIM}Press Ctrl+C to stop both processes.${RESET}"
echo -e "${BOLD}${GREEN}========================================================================${RESET}"
echo ""

wait
