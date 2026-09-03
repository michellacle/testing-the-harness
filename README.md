# Testing the AI factory

This is a report-only v0 regression harness for the factory boundary selected
for this prototype:

- **Harness:** a fresh, isolated native VS Code Agent Host.
- **Skill:** [`.github/skills/implement-feature/SKILL.md`](.github/skills/implement-feature/SKILL.md),
  discovered from the workspace by a natural feature request.
- **Worker:** `Qwen2.5-Coder-7B-Instruct` GGUF `Q4_K_M`, served locally by
  a pinned llama.cpp runtime.

The suite is three small TypeScript/Vitest feature fixtures. Every attempt gets
a clean copied workspace. A hidden checker runs visible tests, verifies a
focused test was changed, enforces the changed-file boundary, and independently
tests the requested behavior.

## Bootstrap

1. Install the project tooling with `npm install`.
2. Install the pinned `llama.cpp` `v0.3.0` release and set `LLAMA_SERVER` to
   its `llama-server` executable.
3. Download and verify the selected model:

   ```sh
   scripts/download-model.sh
   ```

4. In separate terminals, start the model and agent host:

   ```sh
   LLAMA_SERVER=/absolute/path/to/llama-server scripts/start-model.sh
   scripts/start-agent-host.sh
   ```

5. Read the token in `.bench/agent-host/connection-token`, then run:

   ```sh
   BENCH_AHP_URL=ws://127.0.0.1:8765 \
   BENCH_AHP_TOKEN="$(cat .bench/agent-host/connection-token)" \
   npm run bench -- --runs 1
   ```

The runner writes complete agent output and a JSON report to the ignored
`.bench/artifacts/` directory. It uses the Agent Host Protocol client rather
than UI automation. Host startup installs the repository-owned Custom Endpoint
configuration and enables experimental Agent Host BYOK models in its isolated
user-data directory. In VS Code 1.136.0, Copilot Chat is bundled with the VS
Code binary, so startup asserts its pinned built-in version (0.64.0) rather
than attempting to install a separate Marketplace copy. It does not fall back
to a hosted or workstation-default model.

## Calibration and baseline

Run five unchanged suites during calibration:

```sh
BENCH_AHP_URL=ws://127.0.0.1:8765 \
BENCH_AHP_TOKEN="$(cat .bench/agent-host/connection-token)" \
npm run bench -- --runs 5
```

Review the artifacts and manually approve the stable result. Commit only a
compact baseline summary and the configuration; retain raw transcripts and
diffs locally. Candidate changes run three suites. v0 reports their pass rate
and operational diagnostics but deliberately does not block a change until a
noise threshold has been measured and approved.

## Safety and determinism

Evaluated agent sessions receive only their temporary fixture workspace and
terminal tools. Configure VS Code Agent Host sandboxing to disable network
access before running a benchmark. The runner does not claim a worktree is a
security boundary. Model SHA-256 verification is mandatory before evaluation;
the model server uses a fixed seed and temperature.
