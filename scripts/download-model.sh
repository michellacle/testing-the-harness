#!/usr/bin/env bash
set -euo pipefail

readonly config=".bench/config.json"
readonly output_directory=".bench/model"
readonly source="$(jq -r '.worker.artifact.source' "$config")"
readonly filename="$(jq -r '.worker.artifact.filename' "$config")"
readonly expected_sha256="$(jq -r '.worker.artifact.sha256' "$config")"
readonly output_path="$output_directory/$filename"

mkdir -p "$output_directory"
if [[ ! -f "$output_path" ]]; then
  curl --fail --location --continue-at - --output "$output_path" "$source"
fi

printf '%s  %s\n' "$expected_sha256" "$output_path" | sha256sum --check
