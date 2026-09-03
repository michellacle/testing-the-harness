# Testing the AI factory

`testing-the-harness` is a local, report-only regression harness for an AI
coding factory:

| Factory part | Fixture in this repository | Why it is pinned |
| --- | --- | --- |
| Harness | VS Code Agent Host and its bundled Copilot Chat provider | Agent loops, tools, and customization discovery can change between releases. |
| Skill | [`implement-feature`](.github/skills/implement-feature/SKILL.md) | A skill is versioned behavioral software, not untested prose. |
| Worker | Qwen2.5-Coder-7B-Instruct GGUF Q4_K_M served by llama.cpp | A local artifact can be checksum-verified and does not silently change. |

The benchmark asks whether a change to **your skills or harness configuration**
makes the factory worse while holding the worker constant. It is not a model
leaderboard and does not claim that this model is best at coding.

## Current integration status

The model/runtime setup has been verified on the original workstation:
llama.cpp v0.3.0 builds with CUDA, the selected 4.4-GB model verifies against
the committed SHA-256, and its local endpoint advertises the configured model
ID.

The first native Agent Host attempt also exposed a current VS Code 1.136.0
limitation: standalone Agent Host sessions do not load Custom Endpoint BYOK
models from the isolated editor-profile `chatLanguageModels.json` file. The
host accepts the BYOK enablement setting but advertises no local model, so the
runner correctly fails closed instead of falling back to a hosted model.

This repository is therefore ready for fixture/oracle development and local
worker provisioning, but it is **not yet capable of an end-to-end native
Agent Host evaluation** on that VS Code build. Complete the missing provider
integration (for example, a supported Agent Host model-provider extension or
a VS Code release that supports standalone Custom Endpoint configuration),
then rerun the first-suite steps below and calibrate from scratch.

## What it tests

v0 measures the `implement-feature` skill with three small TypeScript/Vitest
fixtures:

| Fixture | Requested behavior | Important acceptance properties |
| --- | --- | --- |
| [`todo-completion`](.bench/fixtures/todo-completion) | Complete a todo by ID | Immutable update; rejects a missing ID. |
| [`email-normalization`](.bench/fixtures/email-normalization) | Normalize email input | Trims, lowercases, and rejects blank values. |
| [`cart-quantity`](.bench/fixtures/cart-quantity) | Increment an existing item | Immutable update while preserving add-new behavior. |

Each task begins from a clean copy of its fixture. The agent receives a natural
feature request, so the benchmark covers both skill discovery and skill
execution. Before scoring, the runner asserts that VS Code loaded
`.github/skills/implement-feature/SKILL.md`.

Each attempt passes only when all of these mechanical oracles pass:

1. The fixture's visible Vitest suite passes.
2. At least one visible test file changed.
3. The diff contains only the task's explicitly allowed source and test files.
4. A hidden acceptance check verifies the requested behavior independently of
   the agent-authored tests.

This deliberately avoids an LLM judge in v0. A correct feature is a boolean,
not an opinion.

## How a run works

1. [`scripts/download-model.sh`](scripts/download-model.sh) downloads the
   configured GGUF and verifies its SHA-256.
2. [`scripts/start-model.sh`](scripts/start-model.sh) starts llama.cpp on the
   loopback-only OpenAI-compatible endpoint.
3. [`scripts/start-agent-host.sh`](scripts/start-agent-host.sh) starts a fresh,
   token-protected VS Code Agent Host with isolated user data. It installs the
   repository-owned local model configuration and asserts the pinned bundled
   Copilot Chat version.
4. [`src/run.ts`](src/run.ts) connects over the Agent Host Protocol, confirms
   the exact model is advertised, creates an isolated session/workspace, and
   prompts the agent.
5. [`src/check.ts`](src/check.ts) runs the mechanical oracle and emits the
   attempt result.
6. The runner writes full session evidence and `report.json` under the ignored
   [`.bench/artifacts/`](.bench/artifacts/) directory.

The limits are part of the test fixture: 15 minutes, 30 agent turns, and 80
tool calls per task. Review [`.bench/config.json`](.bench/config.json) for the
complete pinned configuration and [`.bench/tasks.json`](.bench/tasks.json) for
task prompts and allowed diff boundaries.

## Prerequisites

- Linux with an NVIDIA GPU capable of running the selected 7B Q4 model
  (the original setup uses an 8-GB RTX 4070 Laptop GPU).
- VS Code **1.136.0**, including bundled Copilot Chat **0.64.0**.
- Node.js and npm.
- `curl`, `jq`, `cmake`, and Ninja.
- A CUDA-enabled llama.cpp **v0.3.0** `llama-server` binary.

The repository deliberately does not download, commit, or distribute model
weights. Model and run artifacts are ignored by Git.

## Setup and first run

Install the locked Node tooling:

```sh
npm install
```

Build llama.cpp v0.3.0 with CUDA. For example:

```sh
git clone --depth 1 --branch v0.3.0 https://github.com/ggml-org/llama.cpp.git .bench/runtime/llama.cpp
cmake -S .bench/runtime/llama.cpp -B .bench/runtime/llama.cpp/build -G Ninja \
  -DGGML_CUDA=ON -DCMAKE_BUILD_TYPE=Release
cmake --build .bench/runtime/llama.cpp/build --target llama-server
```

Download and verify the configured artifact:

```sh
scripts/download-model.sh
```

Start the model and Agent Host in separate terminals:

```sh
LLAMA_SERVER="$PWD/.bench/runtime/llama.cpp/build/bin/llama-server" \
  scripts/start-model.sh
```

```sh
scripts/start-agent-host.sh
```

The host prints a loopback WebSocket URL with an encoded `tkn` query parameter.
Use that URL as `BENCH_AHP_URL`. **After a compatible standalone BYOK provider
has been confirmed**, run one full suite:

```sh
BENCH_AHP_URL='ws://127.0.0.1:8765?tkn=<URL-ENCODED-TOKEN>' \
  npm run bench -- --runs 1
```

The runner fails closed if the host is unavailable, the model ID is not
advertised, the skill is not loaded, or an oracle fails. It never falls back to
a hosted or workstation-default model. On VS Code 1.136.0, expect the
model-advertisement preflight to fail for the limitation described above.

## Calibration and interpreting results

An agent is multi-step and may vary even at temperature zero. Before treating
any change as a regression, calibrate on the unchanged factory:

```sh
BENCH_AHP_URL='ws://127.0.0.1:8765?tkn=<URL-ENCODED-TOKEN>' \
  npm run bench -- --runs 5
```

This produces 15 attempts: five runs of each of the three fixtures. Inspect
the raw session evidence and per-task results before approving a baseline.
Commit only a compact, manually approved baseline summary and configuration;
keep transcripts and diffs in the ignored artifacts directory.

Candidate changes should run three full suites (nine attempts):

```sh
BENCH_AHP_URL='ws://127.0.0.1:8765?tkn=<URL-ENCODED-TOKEN>' \
  npm run bench -- --runs 3
```

v0 reports binary fixture pass rate and operational diagnostics separately. It
does **not** block changes until repeated calibration establishes a credible
noise band and an approved comparison threshold.

## Extending the harness

### Add a task

1. Copy an existing directory under [`.bench/fixtures/`](.bench/fixtures/).
2. Keep the fixture minimal: include production code, visible tests, a
   `FEATURE.md` request, and no hidden expected implementation.
3. Add the fixture to [`.bench/tasks.json`](.bench/tasks.json) with a natural
   prompt and exact `allowedChanges`.
4. Add a dedicated behavior assertion in
   [`runAcceptanceCheck`](src/check.ts). The acceptance check must reject
   plausible cheating or overfitting, such as mutation, an unhandled edge case,
   or a changed public behavior.
5. Add or update [`tests/check.test.ts`](tests/check.test.ts) to prove the
   oracle accepts a correct solution and rejects a meaningful incorrect one.
6. Run `npm run build` and `npm test`, then include the new task in
   calibration before changing the baseline.

Do not make a task’s oracle depend only on the tests the agent can edit. The
hidden check is what turns a plausible-looking change into a benchmark.

### Test another skill

Create a skill under `.github/skills/<skill-name>/SKILL.md`, write tasks that
exercise its specific behavior, and make the runner assert that exact skill was
loaded. Keep independent task groups and baselines per skill so a regression is
attributable. Avoid generic tasks that do not map to a playbook you maintain.

### Change the worker or harness

Treat a new model artifact, llama.cpp build, VS Code release, provider version,
model settings, or tool configuration as a **new factory fixture**:

1. Update [`.bench/config.json`](.bench/config.json) with exact versions,
   source URL, and checksum.
2. Re-run the complete calibration suite.
3. Inspect outcomes and manually approve a new baseline.

Never compare scores across changed worker or harness fixtures as though they
measured only a skill change.

## Safety and reproducibility boundaries

- Use Agent Host sandboxing to disable network access in evaluated sessions.
  Workspace isolation is not an operating-system security boundary.
- Preinstall fixture dependencies so the evaluated agent does not need network
  access.
- The model endpoint and Agent Host bind only to localhost.
- The Agent Host token is written only beneath ignored `.bench/agent-host/`.
- The model’s committed checksum is verified before it is served.
- Do not commit model artifacts, session transcripts, or generated workspaces.

## Development checks

```sh
npm run build
npm test
```

The checker tests prove that the oracle accepts a correct immutable todo
completion implementation and rejects a mutating implementation. They do not
replace a live Agent Host calibration run.
