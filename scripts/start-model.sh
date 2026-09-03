#!/usr/bin/env bash
set -euo pipefail

readonly config=".bench/config.json"
readonly model_directory=".bench/model"
readonly llama_server="${LLAMA_SERVER:?Set LLAMA_SERVER to the pinned llama-server executable.}"
readonly filename="$(jq -r '.worker.artifact.filename' "$config")"
readonly model_id="$(jq -r '.worker.model' "$config")"
readonly context_window="$(jq -r '.worker.contextWindow' "$config")"
readonly temperature="$(jq -r '.worker.temperature' "$config")"
readonly seed="$(jq -r '.worker.seed' "$config")"

if [[ ! -f "$model_directory/$filename" ]]; then
  printf 'Pinned model is missing. Run scripts/download-model.sh first.\n' >&2
  exit 1
fi

exec "$llama_server" \
  --model "$model_directory/$filename" \
  --alias "$model_id" \
  --host 127.0.0.1 \
  --port 8080 \
  --ctx-size "$context_window" \
  --temp "$temperature" \
  --seed "$seed"
