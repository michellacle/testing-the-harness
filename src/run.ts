import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import type { BenchConfig, CheckResult, Task, TaskSuite } from "./types.js";

interface AttemptResult {
  readonly taskId: string;
  readonly passed: boolean;
  readonly durationMs: number;
  readonly check?: CheckResult;
  readonly error?: string;
  readonly transcriptPath?: string;
}

interface Report {
  readonly schemaVersion: 1;
  readonly startedAt: string;
  readonly mode: "report-only";
  readonly attempts: readonly AttemptResult[];
  readonly passRate: number;
}

function run(command: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number } = {}): string {
  try {
    return execFileSync(command, args, {
      cwd: options.cwd,
      env: options.env,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: options.timeout
    });
  } catch (error) {
    const detail = error as { stdout?: Buffer; stderr?: Buffer; message: string };
    throw new Error(
      [detail.message, detail.stdout?.toString(), detail.stderr?.toString()].filter(Boolean).join("\n")
    );
  }
}

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required. Start the isolated VS Code Agent Host before running the bench.`);
  }
  return value;
}

function parseRuns(): number {
  const index = process.argv.indexOf("--runs");
  if (index === -1) {
    return 1;
  }
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error("--runs must be a positive integer.");
  }
  return value;
}

function loadJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, "utf8")) as T;
}

function createWorkspace(repositoryRoot: string, task: Task, attemptName: string): string {
  const source = path.join(repositoryRoot, task.fixture);
  const workspace = path.join(repositoryRoot, ".bench/workspaces", attemptName);
  rmSync(workspace, { recursive: true, force: true });
  mkdirSync(path.dirname(workspace), { recursive: true });
  cpSync(source, workspace, { recursive: true });
  run("git", ["init", "--quiet"], { cwd: workspace });
  run("git", ["config", "user.email", "bench@example.invalid"], { cwd: workspace });
  run("git", ["config", "user.name", "Harness Bench"], { cwd: workspace });
  run("git", ["add", "."], { cwd: workspace });
  run("git", ["commit", "--quiet", "-m", "Pristine fixture"], { cwd: workspace });
  return workspace;
}

function ahpxCommand(repositoryRoot: string): string {
  const command = path.join(repositoryRoot, "node_modules", ".bin", "ahpx");
  if (!existsSync(command)) {
    throw new Error("AHP client is missing. Run npm install before running the bench.");
  }
  return command;
}

function executeAttempt(
  repositoryRoot: string,
  config: BenchConfig,
  task: Task,
  runNumber: number,
  artifactDirectory: string,
  ahpx: string,
  environment: NodeJS.ProcessEnv
): AttemptResult {
  const attemptName = `${task.id}-run-${runNumber}`;
  const workspace = createWorkspace(repositoryRoot, task, attemptName);
  const transcriptPath = path.join(artifactDirectory, `${attemptName}.txt`);
  const startedAt = performance.now();
  const sessionName = `${attemptName}-${Date.now()}`;

  try {
    run(
      ahpx,
      [
        "session",
        "new",
        "--cwd",
        workspace,
        "--provider",
        config.harness.provider,
        "--model",
        config.worker.model,
        "--config",
        `maxTurns=${config.budget.maxTurns}`,
        "--config",
        `maxToolCalls=${config.budget.maxToolCalls}`,
        "--config",
        "permissions=workspace",
        "--config",
        "isolation=folder",
        "--name",
        sessionName
      ],
      {
        cwd: repositoryRoot,
        env: environment,
        timeout: 10_000
      }
    );
    const customizations = run(
      ahpx,
      ["session", "customization", "list", "--session-name", sessionName],
      { cwd: repositoryRoot, env: environment, timeout: 10_000 }
    );
    if (!customizations.includes(config.harness.skillPath)) {
      throw new Error(
        `Agent session did not load ${config.harness.skillPath}; refusing to score an uncustomized run.`
      );
    }
    const response = run(
      ahpx,
      ["prompt", task.prompt, "--session-name", sessionName, "--approve-all"],
      {
        cwd: repositoryRoot,
        env: environment,
        timeout: config.budget.timeoutMinutes * 60_000
      }
    );
    const transcript = run(
      ahpx,
      ["session", "export", sessionName, "--format", "json"],
      { cwd: repositoryRoot, env: environment, timeout: 10_000 }
    );
    writeFileSync(transcriptPath, `${customizations}\n\n${response}\n\n${transcript}`);
    const checkOutput = run(
      path.join(repositoryRoot, "node_modules", ".bin", "tsx"),
      [path.join(repositoryRoot, "src/check.ts"), task.id, workspace],
      { cwd: repositoryRoot, env: { ...environment, BENCH_ROOT: repositoryRoot } }
    );
    const check = JSON.parse(checkOutput) as CheckResult;
    return {
      taskId: task.id,
      passed: check.passed,
      durationMs: Math.round(performance.now() - startedAt),
      check,
      transcriptPath
    };
  } catch (error) {
    return {
      taskId: task.id,
      passed: false,
      durationMs: Math.round(performance.now() - startedAt),
      error: String(error),
      transcriptPath
    };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}

const repositoryRoot = process.cwd();
const config = loadJson<BenchConfig>(path.join(repositoryRoot, ".bench/config.json"));
const suite = loadJson<TaskSuite>(path.join(repositoryRoot, ".bench/tasks.json"));
const runs = parseRuns();
const endpoint = requiredEnvironment("BENCH_AHP_URL");
const token = requiredEnvironment("BENCH_AHP_TOKEN");
const artifactDirectory = path.join(
  repositoryRoot,
  ".bench/artifacts",
  new Date().toISOString().replaceAll(":", "-")
);
mkdirSync(artifactDirectory, { recursive: true });

const environment = {
  ...process.env,
  HOME: path.join(repositoryRoot, ".bench/ahpx"),
  XDG_CONFIG_HOME: path.join(repositoryRoot, ".bench/ahpx/config"),
  XDG_DATA_HOME: path.join(repositoryRoot, ".bench/ahpx/data")
};
mkdirSync(environment.HOME, { recursive: true });
const ahpx = ahpxCommand(repositoryRoot);
run(ahpx, ["server", "add", "bench", "--url", endpoint, "--token", token, "--default"], {
  cwd: repositoryRoot,
  env: environment
});
const availableAgents = run(ahpx, ["agents", "--server", "bench"], {
  cwd: repositoryRoot,
  env: environment,
  timeout: 10_000
});
if (!availableAgents.includes(config.worker.model)) {
  throw new Error(
    `Pinned model ${config.worker.model} is not available through the configured Agent Host. Refusing fallback.`
  );
}

const attempts: AttemptResult[] = [];
for (let runNumber = 1; runNumber <= runs; runNumber += 1) {
  for (const task of suite.tasks) {
    attempts.push(executeAttempt(repositoryRoot, config, task, runNumber, artifactDirectory, ahpx, environment));
  }
}

const report: Report = {
  schemaVersion: 1,
  startedAt: new Date().toISOString(),
  mode: "report-only",
  attempts,
  passRate: attempts.filter((attempt) => attempt.passed).length / attempts.length
};
writeFileSync(path.join(artifactDirectory, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
