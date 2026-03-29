#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

export OPENCV_AVFOUNDATION_SKIP_AUTH=1

VENV_DIR=".venv312"
VENV_PYTHON="$VENV_DIR/bin/python"

find_python312() {
  if command -v python3.12 >/dev/null 2>&1; then
    command -v python3.12
    return 0
  fi

  if [ -x "/opt/homebrew/bin/python3.12" ]; then
    echo "/opt/homebrew/bin/python3.12"
    return 0
  fi

  if [ -x "/usr/local/bin/python3.12" ]; then
    echo "/usr/local/bin/python3.12"
    return 0
  fi

  return 1
}

if [ ! -x "$VENV_PYTHON" ]; then
  echo "Creating Python 3.12 virtual environment..."
  PYTHON312="$(find_python312 || true)"

  if [ -z "${PYTHON312:-}" ]; then
    echo "Python 3.12 was not found."
    echo "Install Python 3.12 first, then rerun this launcher."
    exit 1
  fi

  "$PYTHON312" -m venv "$VENV_DIR"
fi

echo "Ensuring Python dependencies are installed..."
"$VENV_PYTHON" -m pip install --upgrade pip
"$VENV_PYTHON" -m pip install opencv-python mediapipe

if [ ! -d "node_modules" ]; then
  echo "Installing Node dependencies..."
  npm install
fi

cleanup() {
  if [ -n "${BRIDGE_PID:-}" ] && kill -0 "$BRIDGE_PID" >/dev/null 2>&1; then
    kill "$BRIDGE_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting gesture bridge in the background..."
"$VENV_PYTHON" gesture_toggle_bridge.py &
BRIDGE_PID=$!

echo "Starting Vite app..."
npm run dev
