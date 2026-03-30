#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

export OPENCV_AVFOUNDATION_SKIP_AUTH=1

VENV_DIR=".venv312"
VENV_PYTHON="$VENV_DIR/bin/python"
SOCKET_PORT="3001"

get_local_ip() {
  for interface in en0 en1 en2; do
    if ip=$(ipconfig getifaddr "$interface" 2>/dev/null); then
      if [ -n "${ip:-}" ]; then
        echo "$ip"
        return 0
      fi
    fi
  done

  if command -v python3 >/dev/null 2>&1; then
    python3 - <<'PY'
import socket

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
try:
    sock.connect(("8.8.8.8", 80))
    print(sock.getsockname()[0])
finally:
    sock.close()
PY
    return 0
  fi

  return 1
}

prompt_role() {
  while true; do
    echo
    echo "Room setup:"
    echo "  Type 'host' to create a room on this machine."
    echo "  Type 'join' to connect to someone else's room."
    printf "Enter choice [host/join]: "
    read -r role
    normalized_role="$(printf '%s' "$role" | tr '[:upper:]' '[:lower:]')"
    case "$normalized_role" in
      host)
        ROLE="host"
        return 0
        ;;
      join)
        ROLE="join"
        return 0
        ;;
      *)
        echo "Please type 'host' or 'join'."
        ;;
    esac
  done
}

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
"$VENV_PYTHON" -m pip install opencv-python "mediapipe==0.10.14"

if [ ! -d "node_modules" ]; then
  echo "Installing Node dependencies..."
  npm install
fi

ROLE=""
prompt_role
SOCKET_URL=""
HOST_IP=""

if [ "$ROLE" = "host" ]; then
  HOST_IP="$(get_local_ip || true)"
  if [ -z "${HOST_IP:-}" ]; then
    echo "Could not determine this machine's LAN IP automatically."
    echo "Other devices may need you to look it up manually."
    HOST_IP="127.0.0.1"
  fi
  SOCKET_URL="http://${HOST_IP}:${SOCKET_PORT}"
else
  echo
  echo "Join room:"
  echo "  Ask the host for the printed room IP address."
  printf "Enter host IP address (example: 192.168.1.23): "
  read -r HOST_IP
  if [ -z "${HOST_IP:-}" ]; then
    echo "A host IP is required to join a room."
    exit 1
  fi
  SOCKET_URL="http://${HOST_IP}:${SOCKET_PORT}"
fi

cleanup() {
  if [ -n "${BRIDGE_PID:-}" ] && kill -0 "$BRIDGE_PID" >/dev/null 2>&1; then
    kill "$BRIDGE_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

echo "Starting gesture bridge in the background..."
"$VENV_PYTHON" gesture_toggle_bridge.py &
BRIDGE_PID=$!

if [ "$ROLE" = "host" ]; then
  echo "Starting shared room server..."
  PORT="$SOCKET_PORT" npm run server &
  SERVER_PID=$!
  echo "Room hosted at ${SOCKET_URL}"
  echo "Share this IP with others: ${HOST_IP}"
else
  echo "Joining shared room at ${SOCKET_URL}"
fi

echo "Starting Vite app..."
VITE_SOCKET_URL="$SOCKET_URL" npm run dev -- --host 0.0.0.0
