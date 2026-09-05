#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_DIR="$ROOT_DIR/.dev"
PID_DIR="$DEV_DIR/pids"
LOG_DIR="$DEV_DIR/logs"

STOP_DOCKER=0
CLEAN_LOGS=0

usage() {
  cat <<USAGE
Usage: scripts/dev-stop.sh [options]

Stops processes started by scripts/dev-start.sh.

Options:
  --docker       Also stop mobile-x-postgres and mobile-x-redis containers.
  --clean-logs   Delete .dev/logs after stopping processes.
  -h, --help     Show this help.
USAGE
}

log() {
  printf '[dev] %s\n' "$*"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker) STOP_DOCKER=1 ;;
    --clean-logs) CLEAN_LOGS=1 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
  shift
done

stop_pid_file() {
  local pid_file="$1"
  local name pid

  [[ -f "$pid_file" ]] || return 0

  name="$(basename "$pid_file" .pid)"
  pid="$(cat "$pid_file")"

  if kill -0 "$pid" >/dev/null 2>&1; then
    log "Stopping $name process group $pid"
    kill -- "-$pid" >/dev/null 2>&1 || kill "$pid" >/dev/null 2>&1 || true

    for _ in $(seq 1 20); do
      if ! kill -0 "$pid" >/dev/null 2>&1; then
        break
      fi
      sleep 0.5
    done

    if kill -0 "$pid" >/dev/null 2>&1; then
      log "Force stopping $name process group $pid"
      kill -9 -- "-$pid" >/dev/null 2>&1 || kill -9 "$pid" >/dev/null 2>&1 || true
    fi
  else
    log "$name was not running"
  fi

  rm -f "$pid_file"
}

if [[ -d "$PID_DIR" ]]; then
  for name in android-run mobile-metro admin-panel backend; do
    stop_pid_file "$PID_DIR/${name}.pid"
  done

  for pid_file in "$PID_DIR"/*.pid; do
    [[ -e "$pid_file" ]] || continue
    stop_pid_file "$pid_file"
  done
else
  log "No dev PID directory found"
fi

if [[ "$STOP_DOCKER" -eq 1 ]]; then
  if command -v docker >/dev/null 2>&1; then
    log "Stopping Docker containers"
    docker stop mobile-x-postgres mobile-x-redis >/dev/null 2>&1 || true
  else
    log "Docker not found; skipping containers"
  fi
fi

if [[ "$CLEAN_LOGS" -eq 1 ]]; then
  log "Deleting logs in $LOG_DIR"
  rm -rf "$LOG_DIR"
fi

log "Stopped dev processes"
