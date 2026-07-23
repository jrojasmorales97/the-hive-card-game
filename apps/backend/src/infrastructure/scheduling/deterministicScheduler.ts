import type { Clock } from '../../application/ports/clock.js';
import type { Scheduler } from '../../application/ports/scheduler.js';
import type { ApplicationEffect } from '../../application/result.js';

export type DeterministicSchedulerHistory =
  | { type: 'replace'; roomCode: string; trigger: string; dueAt: number }
  | { type: 'cancel'; roomCode: string; trigger: string }
  | { type: 'cancel-room'; roomCode: string }
  | { type: 'cancel-all' }
  | { type: 'execute'; roomCode: string; trigger: string };

export type PendingJob = { roomCode: string; trigger: string; effect: ApplicationEffect; sequence: number };

/** Deterministic scheduler with inspectable state for application and callback tests. */
export class DeterministicScheduler implements Scheduler {
  private readonly jobs = new Map<string, PendingJob>();
  private sequence = 0;
  readonly history: DeterministicSchedulerHistory[] = [];

  constructor(private readonly run: (effect: ApplicationEffect) => void, private readonly clock: Clock) {}

  get pendingJobs(): PendingJob[] {
    return [...this.jobs.values()].sort((left, right) => left.effect.dueAt - right.effect.dueAt || left.sequence - right.sequence);
  }

  schedule(roomCode: string, trigger: string, effect: ApplicationEffect): void {
    const id = this.id(roomCode, trigger);
    this.jobs.delete(id);
    this.jobs.set(id, { roomCode, trigger, effect, sequence: ++this.sequence });
    this.history.push({ type: 'replace', roomCode, trigger, dueAt: effect.dueAt });
  }

  cancel(roomCode: string, trigger: string): void {
    if (!this.jobs.delete(this.id(roomCode, trigger))) return;
    this.history.push({ type: 'cancel', roomCode, trigger });
  }

  cancelRoom(roomCode: string): void {
    let cancelled = false;
    for (const job of this.pendingJobs) {
      if (job.roomCode !== roomCode) continue;
      this.jobs.delete(this.id(job.roomCode, job.trigger));
      cancelled = true;
    }
    if (cancelled) this.history.push({ type: 'cancel-room', roomCode });
  }

  cancelAll(): void {
    if (this.jobs.size === 0) return;
    this.jobs.clear();
    this.history.push({ type: 'cancel-all' });
  }

  runNextDue(): boolean {
    const job = this.pendingJobs.find((candidate) => candidate.effect.dueAt <= this.clock.now());
    if (!job) return false;
    this.jobs.delete(this.id(job.roomCode, job.trigger));
    this.history.push({ type: 'execute', roomCode: job.roomCode, trigger: job.trigger });
    this.run(job.effect);
    return true;
  }

  runDue(): number {
    let count = 0;
    while (this.runNextDue()) count += 1;
    return count;
  }

  private id(roomCode: string, trigger: string): string { return `${roomCode}:${trigger}`; }
}
