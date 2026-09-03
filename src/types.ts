export interface BenchConfig {
  readonly harness: {
    readonly provider: string;
    readonly skillPath: string;
  };
  readonly worker: {
    readonly model: string;
  };
  readonly budget: {
    readonly timeoutMinutes: number;
    readonly maxTurns: number;
    readonly maxToolCalls: number;
  };
}

export interface Task {
  readonly id: string;
  readonly fixture: string;
  readonly prompt: string;
  readonly allowedChanges: readonly string[];
}

export interface TaskSuite {
  readonly tasks: readonly Task[];
}

export interface CheckResult {
  readonly taskId: string;
  readonly passed: boolean;
  readonly failures: readonly string[];
  readonly changedFiles: readonly string[];
}
