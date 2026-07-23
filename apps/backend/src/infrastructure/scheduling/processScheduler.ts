import type { Scheduler } from '../../application/ports/scheduler.js';
import type { Clock } from '../../application/ports/clock.js';
import type { ApplicationEffect } from '../../application/result.js';
import { nodeTimerRuntime, type ImmediateHandle, type TimerHandle, type TimerRuntime } from './timerRuntime.js';

type ScheduledProcessJob = {
  roomCode: string;
  trigger: string;
  effect: ApplicationEffect;
  generation: number;
  timeout: TimerHandle | null;
  delivery: ImmediateHandle | null;
};

/** Owns both the timeout wait and the post-timeout delivery for every effect key. */
export class ProcessScheduler implements Scheduler {
  private readonly jobs = new Map<string, ScheduledProcessJob>();
  private nextGeneration = 0;

  constructor(
    private readonly run: (effect: ApplicationEffect) => void,
    private readonly clock: Clock,
    private readonly runtime: TimerRuntime = nodeTimerRuntime,
  ) {}

  schedule(roomCode: string, key: string, effect: ApplicationEffect): void {
    this.cancel(roomCode, key);
    const id = `${roomCode}:${key}`;
    const job: ScheduledProcessJob = {
      roomCode,
      trigger: key,
      effect,
      generation: ++this.nextGeneration,
      timeout: null,
      delivery: null,
    };
    job.timeout = this.runtime.setTimeout(() => this.deliver(id, job), Math.max(0, effect.dueAt - this.clock.now()) + 10);
    this.jobs.set(id, job);
  }

  cancel(roomCode: string, key: string): void {
    const id = `${roomCode}:${key}`;
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.timeout !== null) this.runtime.clearTimeout(job.timeout);
    if (job.delivery !== null) this.runtime.clearImmediate(job.delivery);
    this.jobs.delete(id);
  }

  cancelRoom(roomCode: string): void {
    const prefix = `${roomCode}:`;
    for (const id of [...this.jobs.keys()]) {
      if (!id.startsWith(prefix)) continue;
      const key = id.slice(prefix.length);
      this.cancel(roomCode, key);
    }
  }

  cancelAll(): void {
    for (const job of [...this.jobs.values()]) this.cancel(job.roomCode, job.trigger);
  }

  private deliver(id: string, job: ScheduledProcessJob): void {
    if (this.jobs.get(id) !== job) return;
    job.timeout = null;
    // Let the transport finish the command/ack turn before publishing a due snapshot.
    job.delivery = this.runtime.setImmediate(() => {
      const current = this.jobs.get(id);
      if (current !== job || current.generation !== job.generation) return;
      this.jobs.delete(id);
      job.delivery = null;
      this.run(job.effect);
    });
  }
}
