import assert from 'node:assert/strict';
import test from 'node:test';
import { dispatchApplicationResult } from './dispatcher.js';
import { applicationSucceeded, type ApplicationEffect } from './result.js';

function effect(trigger: ApplicationEffect['trigger']): ApplicationEffect {
  return {
    type: 'schedule',
    roomCode: 'HIVE01',
    trigger,
    dueAt: 100,
    expectedVersion: 4,
    expected: { phase: 'playing', lockReason: null, lockUntil: null },
  };
}

test('dispatcher commits work directives in cancel, event, and replace order', () => {
  const calls: string[] = [];
  const result = applicationSucceeded(
    { committed: true },
    [],
    [{ type: 'room-updated', roomCode: 'HIVE01' }],
    [effect('cpu-turn')],
    [
      { type: 'cancel-room', roomCode: 'HIVE01' },
      { type: 'cancel', roomCode: 'HIVE01', trigger: 'star-settled' },
    ],
  );

  dispatchApplicationResult(result, { publish: () => calls.push('event') }, {
    schedule: (_roomCode, trigger) => calls.push(`schedule:${trigger}`),
    cancel: (_roomCode, trigger) => calls.push(`cancel:${trigger}`),
    cancelRoom: () => calls.push('cancel-room'),
    cancelAll: () => calls.push('cancel-all'),
  });

  assert.deepEqual(calls, ['cancel-room', 'cancel:star-settled', 'event', 'cancel:cpu-turn', 'schedule:cpu-turn']);
  if (!result.ok) return assert.fail('Expected a successful application result');
  assert.deepEqual(result.directives.map((directive) => directive.type), ['cancel-room', 'cancel', 'replace']);
});
