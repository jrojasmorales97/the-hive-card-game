export type TimerHandle = ReturnType<typeof setTimeout>;
export type ImmediateHandle = ReturnType<typeof setImmediate>;

/** Node primitive owner for process scheduling; tests can replace the whole runtime. */
export interface TimerRuntime {
  setTimeout(callback: () => void, delayMs: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
  setImmediate(callback: () => void): ImmediateHandle;
  clearImmediate(handle: ImmediateHandle): void;
}

export const nodeTimerRuntime: TimerRuntime = {
  setTimeout,
  clearTimeout,
  setImmediate,
  clearImmediate,
};
