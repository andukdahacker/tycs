/**
 * Execution package — Fly Machine config and SSE event types.
 * Placeholder types populated incrementally in later stories (3.x).
 */

/** Fly Machine configuration for code execution environments. */
export type FlyMachineConfig = Readonly<{
  image: string
  cpus: number
  memoryMb: number
  timeoutSeconds: number
}>

/** Discriminated union for SSE events from the execution pipeline. */
export type ExecutionEvent =
  | Readonly<{ type: 'compile_output'; data: string }>
  | Readonly<{ type: 'test_result'; passed: boolean; details: string }>
  | Readonly<{ type: 'benchmark_result'; metric: string; value: number; unit: string }>
  | Readonly<{ type: 'execution_error'; message: string }>
  | Readonly<{ type: 'heartbeat' }>
