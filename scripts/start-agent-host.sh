#!/usr/bin/env bash
set -euo pipefail

readonly host_directory=".bench/agent-host"
readonly token_file="$host_directory/connection-token"
readonly port="${BENCH_AHP_PORT:-8765}"
readonly config=".bench/config.json"
readonly manifest="${VSCODE_COPILOT_EXTENSION_MANIFEST:-/usr/share/code/resources/app/extensions/copilot/package.json}"

if [[ ! -f "$manifest" ]]; then
  printf 'Bundled Copilot manifest not found: %s\n' "$manifest" >&2
  exit 1
fi

readonly expected_copilot_version="$(jq -r '.harness.copilotChatVersion' "$config")"
readonly actual_copilot_version="$(jq -r '.version' "$manifest")"
if [[ "$actual_copilot_version" != "$expected_copilot_version" ]]; then
  printf 'Expected Copilot Chat %s but found %s. Update and recalibrate the harness baseline.\n' \
    "$expected_copilot_version" "$actual_copilot_version" >&2
  exit 1
fi

mkdir -p "$host_directory"
install -Dm 600 ".bench/vscode/User/settings.json" "$host_directory/user-data/User/settings.json"
install -Dm 600 ".bench/vscode/User/chatLanguageModels.json" \
  "$host_directory/user-data/User/chatLanguageModels.json"
if [[ ! -f "$token_file" ]]; then
  umask 077
  head -c 32 /dev/urandom | base64 >"$token_file"
fi

printf 'Set BENCH_AHP_URL=ws://127.0.0.1:%s and BENCH_AHP_TOKEN from %s in another terminal.\n' \
  "$port" "$token_file"
exec code agent host \
  --host 127.0.0.1 \
  --port "$port" \
  --connection-token-file "$token_file" \
  --server-data-dir "$host_directory/server-data" \
  --user-data-dir "$host_directory/user-data" \
  --new-instance \
  --foreground
