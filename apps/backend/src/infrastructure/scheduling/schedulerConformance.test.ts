import assert from 'node:assert/strict';
import test from 'node:test';
import type { Clock } from '../../application/ports/clock.js';
import type { ApplicationEffect } from '../../application/result.js';
import { ManualClock } from '../runtime/manualClock.js';
import { DeterministicScheduler } from './deterministicScheduler.js';
import { ProcessScheduler } from './processScheduler.js';
import type { ImmediateHandle, TimerHandle, TimerRuntime } from './timerRuntime.js';

function effect(roomCode: string, trigger: ApplicationEffect['trigger'], dueAt: number): ApplicationEffect {
  return {
    type: 'schedule', roomCode, trigger, dueAt, expectedVersion: 1,
    expected: { phase: 'playing', lockReason: null, lockUntil: null },
  };
}

class ControlledTimerRuntime implements TimerRuntime {
  readonly timeoutCallbacks: Array<() => void> = [];
  readonly immediateCallbacks: Array<() => void> = [];
  readonly clearedTimeouts: TimerHandle[] = [];
  readonly clearedImmediates: ImmediateHandle[] = [];

  setTimeout(callback: () => void): TimerHandle {
    this.timeoutCallbacks.push(callback);
    return (this.timeoutCallbacks.length - 1) as unknown as TimerHandle;
  }

  clearTimeout(handle: TimerHandle): void { this.clearedTimeouts.push(handle); }

  setImmediate(callback: () => void): ImmediateHandle {
    this.immediateCallbacks.push(callback);
    return (this.immediateCallbacks.length - 1) as unknown as ImmediateHandle;
  }

  clearImmediate(handle: ImmediateHandle): void { this.clearedImmediates.push(handle); }

  fireTimeout(index: number): void { this.timeoutCallbacks[index]!(); }
  fireImmediate(index: number): void { this.immediateCallbacks[index]!(); }
}

test('deterministic scheduler replaces by key, orders ties, and records cleanup and execution', () => {
  const clock = new ManualClock(10);
  const ran: string[] = [];
  const scheduler = new DeterministicScheduler((job) => ran.push(`${job.roomCode}:${job.trigger}`), clock);

  scheduler.schedule('A', 'cpu-turn', effect('A', 'cpu-turn', 10));
  scheduler.schedule('A', 'cpu-turn', effect('A', 'cpu-turn', 11));
  scheduler.schedule('A', 'star-settled', effect('A', 'star-settled', 11));
  scheduler.schedule('B', 'dealing-expired', effect('B', 'dealing-expired', 11));
  assert.deepEqual(scheduler.pendingJobs.map((job) => `${job.roomCode}:${job.trigger}`), ['A:cpu-turn', 'A:star-settled', 'B:dealing-expired']);
  assert.equal(scheduler.runDue(), 0);

  clock.advance(1);
  assert.equal(scheduler.runNextDue(), true);
  assert.equal(scheduler.runDue(), 2);
  assert.deepEqual(ran, ['A:cpu-turn', 'A:star-settled', 'B:dealing-expired']);

  scheduler.schedule('A', 'cpu-turn', effect('A', 'cpu-turn', 12));
  scheduler.schedule('A', 'star-settled', effect('A', 'star-settled', 12));
  scheduler.schedule('B', 'dealing-expired', effect('B', 'dealing-expired', 12));
  scheduler.cancel('A', 'cpu-turn');
  scheduler.cancelRoom('A');
  scheduler.cancelAll();
  assert.deepEqual(scheduler.pendingJobs, []);
  assert.deepEqual(scheduler.history.map((entry) => entry.type), [
    'replace', 'replace', 'replace', 'replace', 'execute', 'execute', 'execute',
    'replace', 'replace', 'replace', 'cancel', 'cancel-room', 'cancel-all',
  ]);
});

test('process scheduler owns timeout and delivery, rejecting stale and cancelled callbacks exactly once', () => {
  const runtime = new ControlledTimerRuntime();
  const clock: Clock = { now: () => 0 };
  const ran: string[] = [];
  const scheduler = new ProcessScheduler((job) => ran.push(`${job.roomCode}:${job.trigger}:${job.expectedVersion}`), clock, runtime);

  scheduler.schedule('A', 'cpu-turn', effect('A', 'cpu-turn', 0));
  scheduler.schedule('A', 'cpu-turn', { ...effect('A', 'cpu-turn', 0), expectedVersion: 2 });
  runtime.fireTimeout(0);
  assert.equal(runtime.immediateCallbacks.length, 0, 'replaced timeout cannot create delivery');
  runtime.fireTimeout(1);
  scheduler.cancel('A', 'cpu-turn');
  runtime.fireImmediate(0);
  assert.deepEqual(ran, [], 'cancelled delivery cannot run');

  scheduler.schedule('A', 'star-settled', effect('A', 'star-settled', 0));
  runtime.fireTimeout(2);
  runtime.fireImmediate(1);
  runtime.fireImmediate(1);
  assert.deepEqual(ran, ['A:star-settled:1'], 'active work is removed before one execution');

  scheduler.schedule('A', 'cpu-turn', effect('A', 'cpu-turn', 0));
  scheduler.schedule('B', 'dealing-expired', effect('B', 'dealing-expired', 0));
  scheduler.cancelRoom('A');
  scheduler.cancelAll();
  runtime.fireTimeout(3);
  runtime.fireTimeout(4);
  assert.deepEqual(ran, ['A:star-settled:1']);
  assert.ok(runtime.clearedTimeouts.length >= 3);
  assert.ok(runtime.clearedImmediates.length >= 1);
});
