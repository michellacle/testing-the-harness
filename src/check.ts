import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import type { CheckResult, Task, TaskSuite } from "./types.js";

function command(command: string, args: string[], cwd: string): string {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
}

function readTask(taskId: string, repositoryRoot: string): Task {
  const suite = JSON.parse(readFileSync(path.join(repositoryRoot, ".bench/tasks.json"), "utf8")) as TaskSuite;
  const task = suite.tasks.find((candidate) => candidate.id === taskId);
  if (!task) {
    throw new Error(`Unknown benchmark task: ${taskId}`);
  }
  return task;
}

function changedFiles(workspace: string): string[] {
  return command("git", ["diff", "--name-only", "HEAD"], workspace)
    .split("\n")
    .filter(Boolean)
    .sort();
}

async function runAcceptanceCheck(taskId: string, workspace: string): Promise<void> {
  if (taskId === "todo-completion") {
    const todos = await import(pathToFileURL(path.join(workspace, "src/todos.ts")).href);
    const original = [{ id: "1", title: "Write tests", completed: false }];
    const completed = todos.completeTodo(original, "1");
    if (completed === original || completed[0] === original[0] || completed[0].completed !== true) {
      throw new Error("completeTodo must return new data with the requested todo completed.");
    }
    if (original[0].completed) {
      throw new Error("completeTodo must not mutate its input.");
    }
    if (!completed.some((todo: { id: string }) => todo.id === "1")) {
      throw new Error("completeTodo removed the existing todo.");
    }
    await assertRejects(() => todos.completeTodo(original, "missing"));
    return;
  }

  if (taskId === "email-normalization") {
    const users = await import(pathToFileURL(path.join(workspace, "src/users.ts")).href);
    if (users.createUser("1", " Person@Example.COM ").email !== "person@example.com") {
      throw new Error("createUser did not trim and lowercase the email.");
    }
    await assertRejects(() => users.createUser("1", "   "));
    return;
  }

  if (taskId === "cart-quantity") {
    const cart = await import(pathToFileURL(path.join(workspace, "src/cart.ts")).href);
    const original = [{ sku: "book", quantity: 1 }];
    const incremented = cart.addItem(original, "book");
    if (incremented === original || incremented[0] === original[0] || incremented[0].quantity !== 2) {
      throw new Error("addItem must immutably increment an existing item.");
    }
    if (original[0].quantity !== 1) {
      throw new Error("addItem must not mutate its input.");
    }
    return;
  }

  throw new Error(`No acceptance check registered for ${taskId}.`);
}

async function assertRejects(operation: () => unknown): Promise<void> {
  try {
    await operation();
  } catch {
    return;
  }
  throw new Error("Expected the operation to throw.");
}

async function check(taskId: string, workspace: string, repositoryRoot: string): Promise<CheckResult> {
  const task = readTask(taskId, repositoryRoot);
  const failures: string[] = [];

  try {
    command("npm", ["exec", "--prefix", repositoryRoot, "--", "vitest", "run", workspace], workspace);
  } catch {
    failures.push("Visible Vitest suite failed.");
  }

  const changes = changedFiles(workspace);
  const unexpectedChanges = changes.filter((file) => !task.allowedChanges.includes(file));
  if (unexpectedChanges.length > 0) {
    failures.push(`Changed files outside the allowed boundary: ${unexpectedChanges.join(", ")}`);
  }
  if (!changes.some((file) => file.endsWith(".test.ts"))) {
    failures.push("No visible test file was changed.");
  }

  try {
    await runAcceptanceCheck(taskId, workspace);
  } catch (error) {
    failures.push(`Hidden acceptance check failed: ${String(error)}`);
  }

  return { taskId, passed: failures.length === 0, failures, changedFiles: changes };
}

const [taskId, workspace] = process.argv.slice(2);
if (!taskId || !workspace) {
  throw new Error("Usage: npm run bench:check -- <task-id> <workspace>");
}
if (!existsSync(workspace)) {
  throw new Error(`Workspace does not exist: ${workspace}`);
}
const repositoryRoot = process.env.BENCH_ROOT;
if (!repositoryRoot) {
  throw new Error("BENCH_ROOT must identify the benchmark repository.");
}

const result = await check(taskId, path.resolve(workspace), repositoryRoot);
console.log(JSON.stringify(result, null, 2));
process.exitCode = result.passed ? 0 : 1;
