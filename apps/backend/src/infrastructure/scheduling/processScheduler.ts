import type { Scheduler } from '../../application/ports/scheduler.js';
import type { ApplicationEffect } from '../../application/result.js';

export class ProcessScheduler implements Scheduler {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private readonly run: (effect: ApplicationEffect) => void, private readonly now: () => number = Date.now) {}
  schedule(roomCode: string, key: string, effect: ApplicationEffect): void {
    this.cancel(roomCode, key);
    const id = `${roomCode}:${key}`;
    const timer = setTimeout(() => {
      if (this.timers.get(id) !== timer) return;
      this.timers.delete(id);
      // Let the transport finish the command/ack turn before publishing a due snapshot.
      setImmediate(() => this.run(effect));
    }, Math.max(0, effect.dueAt - this.now()) + 10);
    this.timers.set(id, timer);
  }
  cancel(roomCode: string, key: string): void {
    const id = `${roomCode}:${key}`;
    const timer = this.timers.get(id);
    if (timer) clearTimeout(timer);
    this.timers.delete(id);
  }
  cancelRoom(roomCode: string): void {
    const prefix = `${roomCode}:`;
    for (const id of this.timers.keys()) {
      if (!id.startsWith(prefix)) continue;
      const key = id.slice(prefix.length);
      this.cancel(roomCode, key);
    }
  }
}
