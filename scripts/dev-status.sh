#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT_DIR/.dev/pids"
LOG_DIR="$ROOT_DIR/.dev/logs"
ANDROID_SDK="${ANDROID_SDK:-/home/unknown/Android/Sdk}"
ADB="${ADB:-$ANDROID_SDK/platform-tools/adb}"

process_alive() {
  local pid_file="$1"
  [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" >/dev/null 2>&1
}

echo "Dev process status:"
for name in backend admin-panel mobile-metro android-run; do
  pid_file="$PID_DIR/${name}.pid"
  if process_alive "$pid_file"; then
    echo "  $name: running PID $(cat "$pid_file")"
  else
    echo "  $name: stopped"
  fi
done

echo
echo "Useful URLs:"
echo "  Backend: http://localhost:5000/api/health"
echo "  Admin:   http://localhost:5173"
echo "  Metro:   http://localhost:8081"

echo
echo "Recent logs:"
for log_file in "$LOG_DIR"/backend.log "$LOG_DIR"/admin-panel.log "$LOG_DIR"/mobile-metro.log "$LOG_DIR"/android-run.log; do
  [[ -f "$log_file" ]] || continue
  echo
  echo "==> $log_file <=="
  tail -n 20 "$log_file"
done

if [[ -x "$ADB" ]]; then
  echo
  echo "Android devices:"
  "$ADB" devices -l || true
fi

if [[ -r /proc/sys/fs/inotify/max_user_watches ]]; then
  current="$(cat /proc/sys/fs/inotify/max_user_watches)"
  echo
  echo "Linux file watcher limit:"
  echo "  fs.inotify.max_user_watches=$current"
  if [[ "$current" =~ ^[0-9]+$ ]] && [[ "$current" -lt 524288 ]]; then
    echo "  Recommended for Expo Metro: sudo sysctl -w fs.inotify.max_user_watches=524288"
  fi
fi
