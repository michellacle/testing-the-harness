import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = process.cwd();
const workspaces: string[] = [];

function createWorkspace(fixture: string): string {
  const workspace = mkdtempSync(path.join(tmpdir(), "harness-check-"));
  workspaces.push(workspace);
  cpSync(path.join(repositoryRoot, ".bench/fixtures", fixture), workspace, { recursive: true });
  for (const args of [
    ["init", "--quiet"],
    ["config", "user.email", "bench@example.invalid"],
    ["config", "user.name", "Harness Bench"],
    ["add", "."],
    ["commit", "--quiet", "-m", "Pristine fixture"]
  ]) {
    execFileSync("git", args, { cwd: workspace });
  }
  return workspace;
}

function check(taskId: string, workspace: string) {
  return spawnSync(
    path.join(repositoryRoot, "node_modules/.bin/tsx"),
    [path.join(repositoryRoot, "src/check.ts"), taskId, workspace],
    { cwd: repositoryRoot, env: { ...process.env, BENCH_ROOT: repositoryRoot }, encoding: "utf8" }
  );
}

afterEach(() => {
  for (const workspace of workspaces.splice(0)) {
    rmSync(workspace, { recursive: true, force: true });
  }
});

describe("hidden benchmark checker", () => {
  it("accepts an immutable completion implementation with a focused test edit", () => {
    const workspace = createWorkspace("todo-completion");
    writeFileSync(
      path.join(workspace, "src/todos.ts"),
      `${readFileSync(path.join(workspace, "src/todos.ts"), "utf8")}

export function completeTodo(todos: Todo[], id: string): Todo[] {
  const exists = todos.some((todo) => todo.id === id);
  if (!exists) throw new Error("Todo not found");
  return todos.map((todo) => todo.id === id ? { ...todo, completed: true } : todo);
}
`
    );
    writeFileSync(
      path.join(workspace, "src/todos.test.ts"),
      `${readFileSync(path.join(workspace, "src/todos.test.ts"), "utf8")}\n// Completion coverage added.\n`
    );

    const result = check("todo-completion", workspace);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({ passed: true });
  });

  it("rejects an implementation that mutates the input", () => {
    const workspace = createWorkspace("todo-completion");
    writeFileSync(
      path.join(workspace, "src/todos.ts"),
      `${readFileSync(path.join(workspace, "src/todos.ts"), "utf8")}

export function completeTodo(todos: Todo[], id: string): Todo[] {
  const todo = todos.find((candidate) => candidate.id === id);
  if (!todo) throw new Error("Todo not found");
  todo.completed = true;
  return todos;
}
`
    );
    writeFileSync(
      path.join(workspace, "src/todos.test.ts"),
      `${readFileSync(path.join(workspace, "src/todos.test.ts"), "utf8")}\n// Completion coverage added.\n`
    );

    const result = check("todo-completion", workspace);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("must return new data");
  });
});
