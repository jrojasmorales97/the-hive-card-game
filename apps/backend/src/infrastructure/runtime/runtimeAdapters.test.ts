import assert from 'node:assert/strict';
import test from 'node:test';
import { ManualClock } from './manualClock.js';
import { SequenceRandomSource } from './sequenceRandomSource.js';
import { SystemClock } from './systemClock.js';
import { SystemRandomSource } from './systemRandomSource.js';

test('manual clock fixes, advances, and validates its deterministic instant', () => {
  const clock = new ManualClock(100);
  assert.equal(clock.now(), 100);
  assert.equal(clock.advance(25), 125);
  clock.set(40);
  assert.equal(clock.now(), 40);
  assert.throws(() => clock.set(Number.NaN), /Clock time must be finite/);
  assert.throws(() => clock.advance(Infinity), /Clock duration must be finite/);
  assert.throws(() => new ManualClock(Infinity), /Clock time must be finite/);
});

test('sequence random source preserves consumption order and rejects invalid or exhausted values', () => {
  const random = new SequenceRandomSource([0, 0.5, 0.999]);
  assert.deepEqual([random.next(), random.next(), random.next()], [0, 0.5, 0.999]);
  assert.equal(random.reads, 3);
  assert.throws(() => random.next(), /Random sequence exhausted/);

  for (const value of [-0.1, 1, Infinity, Number.NaN]) {
    const invalid = new SequenceRandomSource([value]);
    assert.throws(() => invalid.next(), /Random values must be finite/);
    assert.equal(invalid.reads, 1);
  }
});

test('system adapters delegate to their process or supplied source', () => {
  const clock = new SystemClock();
  assert.equal(Number.isFinite(clock.now()), true);
  const random = new SystemRandomSource(() => 0.25);
  assert.equal(random.next(), 0.25);
});
