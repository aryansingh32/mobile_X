#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEV_DIR="$ROOT_DIR/.dev"
LOG_DIR="$DEV_DIR/logs"
PID_DIR="$DEV_DIR/pids"

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-mobile-x-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5433}"
REDIS_CONTAINER="${REDIS_CONTAINER:-mobile-x-redis}"
REDIS_PORT="${REDIS_PORT:-6380}"
BACKEND_PORT="${BACKEND_PORT:-5000}"
ADMIN_PORT="${ADMIN_PORT:-5173}"
MOBILE_PORT="${MOBILE_PORT:-8081}"
EXPO_HOST="${EXPO_HOST:-lan}"
HEALTH_WAIT_SECONDS="${HEALTH_WAIT_SECONDS:-120}"
ANDROID_SDK="${ANDROID_SDK:-/home/unknown/Android/Sdk}"
ADB="${ADB:-$ANDROID_SDK/platform-tools/adb}"

DATABASE_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:${POSTGRES_PORT}/mobile_x_db}"
REDIS_URL="${REDIS_URL:-redis://localhost:${REDIS_PORT}/0}"
LAN_IP="${LAN_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}"

START_BACKEND=1
START_ADMIN=1
START_MOBILE=1
RUN_ANDROID=0
RUN_MIGRATIONS=0
SHOW_STATUS=0
INSTALL_DEPS=0

usage() {
  cat <<USAGE
Usage: scripts/dev-start.sh [options]

Starts the local development stack.  Live coloured logs stream automatically
(backend=cyan, admin=yellow, mobile=magenta).  Press Ctrl-C to stop tailing;
background processes keep running.

Options:
  --android          Build/install/launch the Android app on the connected device.
  --migrate          Run Prisma migrate deploy and db push before startup.
  --install          Run npm install in backend, admin-panel, and mobile app.
  --status           Print process, port, Docker, and Android status after startup.
  --backend-only     Start only backend dependencies and backend API.
  --no-backend       Do not start backend API.
  --no-admin         Do not start admin panel.
  --no-mobile        Do not start Expo Metro.
  -h, --help         Show this help.

Useful env overrides:
  BACKEND_PORT=5000 ADMIN_PORT=5173 MOBILE_PORT=8081 POSTGRES_PORT=5433 REDIS_PORT=6380
  LAN_IP=192.168.x.x ANDROID_SDK=/path/to/Android/Sdk EXPO_HOST=lan HEALTH_WAIT_SECONDS=120
USAGE
}

log() {
  printf '[dev] %s\n' "$*"
}

fail() {
  printf '[dev:error] %s\n' "$*" >&2
  exit 1
}

on_error() {
  local exit_code=$?
  printf '[dev:error] command failed at line %s with exit code %s\n' "${BASH_LINENO[0]}" "$exit_code" >&2
}
trap on_error ERR

while [[ $# -gt 0 ]]; do
  case "$1" in
    --android) RUN_ANDROID=1 ;;
    --migrate) RUN_MIGRATIONS=1 ;;
    --install) INSTALL_DEPS=1 ;;
    --status) SHOW_STATUS=1 ;;
    --backend-only) START_BACKEND=1; START_ADMIN=0; START_MOBILE=0 ;;
    --no-backend) START_BACKEND=0 ;;
    --no-admin) START_ADMIN=0 ;;
    --no-mobile) START_MOBILE=0 ;;
    -h|--help) usage; exit 0 ;;
    *) fail "Unknown option: $1" ;;
  esac
  shift
done

mkdir -p "$LOG_DIR" "$PID_DIR"

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "Missing required command: $1"
}

check_dir() {
  [[ -d "$1" ]] || fail "Missing expected directory: $1"
}

port_open() {
  local port="$1"

  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
    return
  fi

  timeout 1 bash -c "cat < /dev/null > /dev/tcp/127.0.0.1/$port" >/dev/null 2>&1
}

wait_for_port() {
  local port="$1"
  local name="$2"

  for _ in $(seq 1 60); do
    if port_open "$port"; then
      log "$name is reachable on port $port"
      return 0
    fi
    sleep 1
  done

  fail "$name did not become reachable on port $port"
}

container_exists() {
  docker ps -a --format '{{.Names}}' | grep -Fxq "$1"
}

start_postgres() {
  if port_open "$POSTGRES_PORT"; then
    log "Postgres already reachable on port $POSTGRES_PORT"
    return
  fi

  if container_exists "$POSTGRES_CONTAINER"; then
    log "Starting existing Postgres container $POSTGRES_CONTAINER"
    docker start "$POSTGRES_CONTAINER" >/dev/null
  else
    log "Creating Postgres container $POSTGRES_CONTAINER on port $POSTGRES_PORT"
    docker run \
      --name "$POSTGRES_CONTAINER" \
      -e POSTGRES_USER=postgres \
      -e POSTGRES_PASSWORD=postgres \
      -e POSTGRES_DB=mobile_x_db \
      -p "${POSTGRES_PORT}:5432" \
      -d postgres:15-alpine >/dev/null
  fi

  wait_for_port "$POSTGRES_PORT" "Postgres"
}

start_redis() {
  if port_open "$REDIS_PORT"; then
    log "Redis already reachable on port $REDIS_PORT"
    return
  fi

  if container_exists "$REDIS_CONTAINER"; then
    log "Starting existing Redis container $REDIS_CONTAINER"
    docker start "$REDIS_CONTAINER" >/dev/null
  else
    log "Creating Redis container $REDIS_CONTAINER on port $REDIS_PORT"
    docker run \
      --name "$REDIS_CONTAINER" \
      -p "${REDIS_PORT}:6379" \
      -d redis:alpine >/dev/null
  fi

  wait_for_port "$REDIS_PORT" "Redis"
}

install_deps() {
  log "Installing npm dependencies"
  npm --prefix "$ROOT_DIR/backend" install
  npm --prefix "$ROOT_DIR/admin-panel" install
  npm --prefix "$ROOT_DIR/modified2/reel-flow" install
}

run_backend_migrations() {
  log "Applying backend database migrations"
  (
    cd "$ROOT_DIR/backend"
    DATABASE_URL="$DATABASE_URL" npx prisma migrate deploy
    DATABASE_URL="$DATABASE_URL" npx prisma db push
  )
}

write_mobile_env() {
  local env_file="$ROOT_DIR/modified2/reel-flow/.env"

  [[ -n "$LAN_IP" ]] || return 0
  [[ -f "$env_file" ]] || touch "$env_file"

  if grep -q '^EXPO_PUBLIC_API_URL=' "$env_file"; then
    sed -i "s#^EXPO_PUBLIC_API_URL=.*#EXPO_PUBLIC_API_URL=http://${LAN_IP}:${BACKEND_PORT}#" "$env_file"
  else
    printf '\nEXPO_PUBLIC_API_URL=http://%s:%s\n' "$LAN_IP" "$BACKEND_PORT" >> "$env_file"
  fi

  log "Mobile API URL set to http://${LAN_IP}:${BACKEND_PORT}"
}

process_alive() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1
}

start_process() {
  local name="$1"
  local dir="$2"
  local command="$3"
  local log_file="$LOG_DIR/${name}.log"
  local pid_file="$PID_DIR/${name}.pid"

  if process_alive "$pid_file"; then
    log "$name already running with PID $(cat "$pid_file")"
    return
  fi

  rm -f "$pid_file"
  : > "$log_file"

  log "Starting $name"
  (
    cd "$dir"
    setsid bash -lc "$command" >"$log_file" 2>&1 &
    echo $! >"$pid_file"
  )

  sleep 2
  if ! process_alive "$pid_file"; then
    tail -n 80 "$log_file" >&2 || true
    fail "$name exited immediately; see $log_file"
  fi

  log "$name PID $(cat "$pid_file"), log $log_file"
}

wait_for_http() {
  local url="$1"
  local name="$2"
  local log_file="${3:-}"

  for second in $(seq 1 "$HEALTH_WAIT_SECONDS"); do
    if curl -fsS --max-time 3 "$url" >/dev/null 2>&1; then
      log "$name is healthy: $url"
      return 0
    fi

    if [[ -n "$log_file" && $((second % 30)) -eq 0 ]]; then
      log "$name is still starting after ${second}s; recent log:"
      tail -n 20 "$log_file" || true
    fi

    sleep 1
  done

  log "$name health check did not pass yet: $url"
  [[ -n "$log_file" ]] && tail -n 80 "$log_file" || true
  return 1
}

check_android_device() {
  [[ -x "$ADB" ]] || fail "ADB not found or not executable: $ADB"

  local devices
  devices="$("$ADB" devices | awk 'NR > 1 && $2 == "device" {print $1}')"
  [[ -n "$devices" ]] || fail "No authorized Android device found. Check USB debugging and run: $ADB devices"

  log "Android device(s): $(echo "$devices" | tr '\n' ' ')"
}

check_inotify_limit() {
  local current
  local recommended=524288

  [[ -r /proc/sys/fs/inotify/max_user_watches ]] || return 0
  current="$(cat /proc/sys/fs/inotify/max_user_watches)"

  if [[ "$current" =~ ^[0-9]+$ ]] && [[ "$current" -lt "$recommended" ]]; then
    log "Linux inotify watch limit is $current; Expo Metro may fail with ENOSPC."
    log "Fix once with: sudo sysctl -w fs.inotify.max_user_watches=$recommended"
    log "Persist with: echo fs.inotify.max_user_watches=$recommended | sudo tee /etc/sysctl.d/99-mobile-x-dev.conf && sudo sysctl --system"
  fi
}


print_status() {
  echo
  log "Status"
  echo "Backend: http://localhost:${BACKEND_PORT}/api/health"
  echo "Admin:   http://localhost:${ADMIN_PORT}"
  echo "Metro:   http://localhost:${MOBILE_PORT}"
  [[ -n "$LAN_IP" ]] && echo "Mobile API URL: http://${LAN_IP}:${BACKEND_PORT}"
  echo
  echo "Processes:"
  for name in backend admin-panel mobile-metro android-run; do
    local pid_file="$PID_DIR/${name}.pid"
    if process_alive "$pid_file"; then
      echo "  $name: running PID $(cat "$pid_file")"
    else
      echo "  $name: stopped"
    fi
  done
  echo
  echo "Logs:"
  echo "  $LOG_DIR/backend.log"
  echo "  $LOG_DIR/admin-panel.log"
  echo "  $LOG_DIR/mobile-metro.log"
  echo "  $LOG_DIR/android-run.log"
  echo
  if [[ -x "$ADB" ]]; then
    "$ADB" devices -l || true
  fi
}

follow_logs() {
  # ANSI colour codes  (stays readable even if a log file is already coloured)
  local C_RESET='\033[0m'
  local C_BACKEND='\033[1;36m'    # bold cyan   – backend
  local C_ADMIN='\033[1;33m'      # bold yellow – admin-panel
  local C_MOBILE='\033[1;35m'     # bold magenta – mobile/metro

  log "Streaming live logs  (Ctrl-C stops tailing only)"
  printf "${C_BACKEND}[BACKEND]${C_RESET}      → $LOG_DIR/backend.log\n"
  printf "${C_ADMIN}[ADMIN]${C_RESET}        → $LOG_DIR/admin-panel.log\n"
  printf "${C_MOBILE}[MOBILE]${C_RESET}       → $LOG_DIR/mobile-metro.log\n"
  echo "─────────────────────────────────────────────────────"

  # Stream each log file in a background subshell, prefix every line with a
  # coloured service tag, then wait for all three together so Ctrl-C stops all.
  tail -n 40 -f "$LOG_DIR/backend.log" 2>/dev/null \
    | sed -u "s/^/$(printf "${C_BACKEND}[BACKEND]   ${C_RESET}") /" &
  local pid_be=$!

  tail -n 40 -f "$LOG_DIR/admin-panel.log" 2>/dev/null \
    | sed -u "s/^/$(printf "${C_ADMIN}[ADMIN]     ${C_RESET}") /" &
  local pid_adm=$!

  tail -n 40 -f "$LOG_DIR/mobile-metro.log" 2>/dev/null \
    | sed -u "s/^/$(printf "${C_MOBILE}[MOBILE]    ${C_RESET}") /" &
  local pid_mob=$!

  # Gracefully kill tails on Ctrl-C
  trap "kill $pid_be $pid_adm $pid_mob 2>/dev/null; trap - INT TERM; return" INT TERM
  wait "$pid_be" "$pid_adm" "$pid_mob" 2>/dev/null || true
  trap - INT TERM
}

require_command docker
require_command npm
require_command curl
check_dir "$ROOT_DIR/backend"
check_dir "$ROOT_DIR/admin-panel"


[[ "$INSTALL_DEPS" -eq 1 ]] && install_deps

if [[ "$START_BACKEND" -eq 1 ]]; then
  start_postgres
  start_redis
  [[ "$RUN_MIGRATIONS" -eq 1 ]] && run_backend_migrations
fi

write_mobile_env

if [[ "$START_BACKEND" -eq 1 ]]; then
  start_process "backend" "$ROOT_DIR/backend" \
    "DATABASE_URL='$DATABASE_URL' REDIS_URL='$REDIS_URL' PORT='$BACKEND_PORT' npm run dev"
  wait_for_http "http://127.0.0.1:${BACKEND_PORT}/api/health" "Backend" "$LOG_DIR/backend.log" || true
fi

if [[ "$START_ADMIN" -eq 1 ]]; then
  start_process "admin-panel" "$ROOT_DIR/admin-panel" \
    "VITE_API_URL='http://localhost:${BACKEND_PORT}/api' npm run dev -- --host 0.0.0.0 --port '$ADMIN_PORT'"
  wait_for_http "http://127.0.0.1:${ADMIN_PORT}" "Admin panel" "$LOG_DIR/admin-panel.log" || true
fi

print_status

if [[ "$SHOW_STATUS" -eq 1 ]]; then
  echo
  log "Docker containers"
  docker ps --filter "name=$POSTGRES_CONTAINER" --filter "name=$REDIS_CONTAINER" || true
fi

# Always stream live logs (Ctrl-C to stop following; processes keep running)
follow_logs
