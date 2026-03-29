#!/bin/bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME_DIR="$ROOT_DIR/.runtime"
PID_FILE="$RUNTIME_DIR/next-dev.pid"
LOG_FILE="$RUNTIME_DIR/next-dev.log"
PORT="${PORT:-3100}"
HOST="${HOST:-127.0.0.1}"
AUTO_OPEN_BROWSER="${AUTO_OPEN_BROWSER:-1}"

mkdir -p "$RUNTIME_DIR"

kill_pid_tree() {
  local pid="$1"

  if ! kill -0 "$pid" >/dev/null 2>&1; then
    return 0
  fi

  pkill -TERM -P "$pid" >/dev/null 2>&1 || true
  kill -TERM "$pid" >/dev/null 2>&1 || true
  sleep 1

  if kill -0 "$pid" >/dev/null 2>&1; then
    pkill -KILL -P "$pid" >/dev/null 2>&1 || true
    kill -KILL "$pid" >/dev/null 2>&1 || true
  fi
}

stop_existing_server() {
  if [[ -f "$PID_FILE" ]]; then
    local tracked_pid
    tracked_pid="$(cat "$PID_FILE" 2>/dev/null || true)"

    if [[ -n "$tracked_pid" ]]; then
      echo "Stopping tracked server PID $tracked_pid..."
      kill_pid_tree "$tracked_pid"
    fi

    rm -f "$PID_FILE"
  fi

  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi

  local listeners
  listeners="$(lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null || true)"

  if [[ -z "$listeners" ]]; then
    return 0
  fi

  while IFS= read -r pid; do
    [[ -z "$pid" ]] && continue

    local command_line
    command_line="$(ps -o command= -p "$pid" 2>/dev/null || true)"

    if [[ "$command_line" == *"$ROOT_DIR"* ]] || [[ "$command_line" == *"next dev"* ]]; then
      echo "Stopping existing app listener PID $pid on port $PORT..."
      kill_pid_tree "$pid"
      continue
    fi

    echo "Port $PORT is already used by another process:"
    echo "$command_line"
    echo "Refusing to kill an unrelated process."
    exit 1
  done <<< "$listeners"
}

open_browser_when_ready() {
  if [[ "$AUTO_OPEN_BROWSER" != "1" ]]; then
    return 0
  fi

  (
    for _ in $(seq 1 45); do
      if curl -fsS "http://$HOST:$PORT" >/dev/null 2>&1; then
        if command -v open >/dev/null 2>&1; then
          open "http://$HOST:$PORT" >/dev/null 2>&1 || true
        fi
        exit 0
      fi

      sleep 1
    done
  ) >/dev/null 2>&1 &
}

if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
  echo "node_modules is missing. Please run npm install first."
  exit 1
fi

stop_existing_server

cd "$ROOT_DIR"
: > "$LOG_FILE"
echo "$$" > "$PID_FILE"
trap 'rm -f "$PID_FILE"' EXIT
open_browser_when_ready

exec > >(tee -a "$LOG_FILE") 2>&1

echo "Starting Design History File Flow at http://$HOST:$PORT ..."
echo "Log: $LOG_FILE"
echo "PID: $$"
echo

npm run dev -- --hostname "$HOST" --port "$PORT"
