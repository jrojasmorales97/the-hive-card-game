import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryRoomRepository } from '../infrastructure/memory/inMemoryRoomRepository.js';
import { EffectUseCases } from './effectUseCases.js';
import { GameUseCases } from './gameUseCases.js';
import type { ApplicationRoom } from './model.js';
import type { ApplicationEffect, ApplicationEvent } from './result.js';

function room(): ApplicationRoom {
  return {
    code: 'HIVE01', displayCode: 'HIVE01', shareable: true, hostId: 'host', status: 'lobby', version: 0, logs: [], game: null,
    players: {
      host: { id: 'host', name: 'Host', connected: true, ready: false, hand: [] },
      guest: { id: 'guest', name: 'Guest', connected: true, ready: false, hand: [] },
    },
  };
}

function playingRoom(overrides: Partial<ApplicationRoom['game']> = {}): ApplicationRoom {
  return {
    ...room(),
    status: 'in-game',
    players: {
      host: { id: 'host', name: 'Host', connected: true, ready: false, hand: [1] },
      guest: { id: 'guest', name: 'Guest', connected: true, ready: false, hand: [3] },
      cpu: { id: 'cpu', name: 'CPU', connected: true, ready: false, hand: [2], isCpu: true },
    },
    game: {
      phase: 'playing', currentLevel: 1, maxLevel: 2, lives: 2, stars: 1, pile: [], pileHistory: [], lastPlayed: null,
      rewardMap: { 1: 'life' }, mode: 'dev-cpu', starProposal: null, interactionLock: null, startedAt: 0, errorCounts: {}, finalResults: null,
      ...overrides,
    },
  };
}

function createFixture() {
  const rooms = new InMemoryRoomRepository();
  const events: ApplicationEvent[] = [];
  const scheduled = new Map<string, ApplicationEffect>();
  let now = 100;
  const scheduler = {
    schedule: (roomCode: string, key: string, effect: ApplicationEffect) => scheduled.set(`${roomCode}:${key}`, effect),
    cancel: (roomCode: string, key: string) => scheduled.delete(`${roomCode}:${key}`),
    cancelRoom: (roomCode: string) => { for (const key of scheduled.keys()) if (key.startsWith(`${roomCode}:`)) scheduled.delete(key); },
  };
  const dependencies = {
    rooms,
    publisher: { publish: (event: ApplicationEvent) => events.push(event) },
    scheduler,
    clock: { now: () => now },
  };
  const game = new GameUseCases({ ...dependencies, random: { next: () => 0.999 }, dealingDuration: () => 10, countdownDuration: () => 20, retryBannerMs: 50, cardDurations: () => ({ errorOverlayMs: 50, roundFlipMs: 10, roundUnflipMs: 10 }), cpuDelay: () => 9 });
  const effects = new EffectUseCases({ ...dependencies, countdownMs: 20, random: { next: () => 0.999 }, cardDurations: () => ({ errorOverlayMs: 50, roundFlipMs: 10, roundUnflipMs: 10 }), levelCompleteMs: () => 50, dealingDuration: () => 10, cpuDelay: () => 9, retryBannerMs: 50 });
  return { rooms, events, scheduled, game, effects, setNow: (value: number) => { now = value; } };
}

function startedEffect(fixture: ReturnType<typeof createFixture>): ApplicationEffect {
  fixture.rooms.save(room(), 0);
  const started = fixture.game.startGame({ roomCode: 'HIVE01', playerId: 'host' });
  assert.equal(started.ok, true);
  const effect = fixture.scheduled.get('HIVE01:dealing-expired');
  assert.ok(effect);
  return effect;
}

test('dealing effect rejects before its deadline and commits once at or after it', () => {
  const before = createFixture();
  const beforeEffect = startedEffect(before);
  before.setNow(109);
  assert.deepEqual(before.effects.materialize(beforeEffect), { ok: false, error: { code: 'invalid-state', message: 'Stale timed transition' } });
  assert.equal(before.rooms.get('HIVE01')?.version, beforeEffect.expectedVersion);

  const at = createFixture();
  const atEffect = startedEffect(at);
  at.setNow(110);
  const result = at.effects.materialize(atEffect);
  assert.equal(result.ok, true);
  assert.equal(at.rooms.get('HIVE01')?.game?.interactionLock, null);
  assert.deepEqual(at.events.map((event) => event.type), ['game-started', 'room-updated']);

  const after = createFixture();
  const afterEffect = startedEffect(after);
  after.setNow(111);
  assert.equal(after.effects.materialize(afterEffect).ok, true);
});

test('stale dealing work cannot write after a version change, retry, replacement lock, or deletion', () => {
  const changed = createFixture();
  const changedEffect = startedEffect(changed);
  const altered = changed.rooms.get('HIVE01')!;
  altered.players.host.ready = true;
  changed.rooms.save(altered, altered.version);
  assert.deepEqual(changed.effects.materialize(changedEffect), { ok: false, error: { code: 'conflict', message: 'Stale timed transition' } });

  const retried = createFixture();
  const firstEffect = startedEffect(retried);
  const terminal = retried.rooms.get('HIVE01')!;
  terminal.game!.phase = 'game-over';
  terminal.game!.interactionLock = null;
  retried.rooms.save(terminal, terminal.version);
  assert.equal(retried.game.retryGame({ roomCode: 'HIVE01', playerId: 'host' }).ok, true);
  assert.equal(retried.effects.materialize(firstEffect).ok, false);

  const deleted = createFixture();
  const deletedEffect = startedEffect(deleted);
  deleted.rooms.delete('HIVE01');
  assert.deepEqual(deleted.effects.materialize(deletedEffect), { ok: false, error: { code: 'not-found', message: 'That room does not exist' } });
});

test('countdown work is replaced by key and only its original version, lock, and deadline can enter play', () => {
  const fixture = createFixture();
  startedEffect(fixture);
  fixture.setNow(110);
  assert.equal(fixture.effects.materialize(fixture.scheduled.get('HIVE01:dealing-expired')!).ok, true);
  assert.equal(fixture.game.setPlayerReady({ roomCode: 'HIVE01', playerId: 'host', ready: true }).ok, true);
  assert.equal(fixture.game.setPlayerReady({ roomCode: 'HIVE01', playerId: 'guest', ready: true }).ok, true);
  const countdown = fixture.scheduled.get('HIVE01:countdown-expired')!;
  assert.equal(countdown.dueAt, 130);

  fixture.setNow(129);
  assert.deepEqual(fixture.effects.materialize(countdown), { ok: false, error: { code: 'invalid-state', message: 'Stale timed transition' } });
  assert.equal(fixture.rooms.get('HIVE01')?.game?.phase, 'focus');

  fixture.setNow(130);
  assert.equal(fixture.effects.materialize(countdown).ok, true);
  assert.equal(fixture.rooms.get('HIVE01')?.game?.phase, 'playing');
  assert.equal(fixture.rooms.get('HIVE01')?.players.host.ready, false);
  assert.deepEqual(fixture.events.map((event) => event.type), ['game-started', 'room-updated', 'room-updated', 'room-updated', 'room-updated']);
  assert.equal(fixture.effects.materialize(countdown).ok, false);
});

test('card callbacks preserve silent error pause, terminal scoring, and stale no-op guards', () => {
  const paused = createFixture();
  const source = playingRoom();
  source.players.host.hand = [4];
  source.players.guest.hand = [2, 5];
  source.players.cpu.hand = [3];
  paused.rooms.save(source, 0);
  assert.equal(paused.game.playCard({ roomCode: 'HIVE01', playerId: 'host', card: 4 }).ok, true);
  const error = paused.scheduled.get('HIVE01:error-expired')!;
  paused.setNow(error.dueAt);
  assert.equal(paused.effects.materialize(error).ok, true);
  assert.equal(paused.rooms.get('HIVE01')?.game?.phase, 'paused');
  assert.equal(paused.events.some((event) => event.type === 'game-paused'), false);
  assert.equal(paused.effects.materialize(error).ok, false);

  const terminal = createFixture();
  const defeated = playingRoom({ lives: 1 });
  defeated.players.host.hand = [4];
  defeated.players.guest.hand = [2];
  defeated.players.cpu.hand = [3];
  terminal.rooms.save(defeated, 0);
  assert.equal(terminal.game.playCard({ roomCode: 'HIVE01', playerId: 'host', card: 4 }).ok, true);
  const due = terminal.scheduled.get('HIVE01:error-expired')!;
  terminal.setNow(due.dueAt);
  assert.equal(terminal.effects.materialize(due).ok, true);
  assert.equal(terminal.rooms.get('HIVE01')?.game?.phase, 'game-over');
  assert.ok(terminal.rooms.get('HIVE01')?.game?.finalResults);
  assert.equal(terminal.events.at(-1)?.type, 'game-over');
});

test('flip, progression, level release, and CPU all return through deterministic application effects', () => {
  const fixture = createFixture();
  const source = playingRoom();
  source.players.guest.hand = [];
  source.players.cpu.hand = [];
  fixture.rooms.save(source, 0);
  assert.equal(fixture.game.playCard({ roomCode: 'HIVE01', playerId: 'host', card: 1 }).ok, true);
  const flip = fixture.scheduled.get('HIVE01:round-flip-expired')!;
  fixture.setNow(flip.dueAt);
  assert.equal(fixture.effects.materialize(flip).ok, true);
  const unflip = fixture.scheduled.get('HIVE01:round-unflip-expired')!;
  fixture.setNow(unflip.dueAt);
  assert.equal(fixture.effects.materialize(unflip).ok, true);
  const next = fixture.scheduled.get('HIVE01:next-level-expired')!;
  fixture.setNow(next.dueAt);
  assert.equal(fixture.effects.materialize(next).ok, true);
  const release = fixture.scheduled.get('HIVE01:level-ready-expired')!;
  fixture.setNow(release.dueAt);
  assert.equal(fixture.effects.materialize(release).ok, true);
  assert.equal(fixture.rooms.get('HIVE01')?.game?.currentLevel, 2);
  assert.ok(fixture.events.some((event) => event.type === 'game-level-completed'));
  assert.ok(fixture.events.some((event) => event.type === 'game-next-level-ready'));

  const cpu = createFixture();
  cpu.rooms.save(playingRoom(), 0);
  assert.equal(cpu.game.playCard({ roomCode: 'HIVE01', playerId: 'host', card: 1 }).ok, true);
  const turn = cpu.scheduled.get('HIVE01:cpu-turn')!;
  cpu.scheduled.delete('HIVE01:cpu-turn');
  cpu.setNow(turn.dueAt);
  assert.equal(cpu.effects.materialize(turn).ok, true);
  assert.deepEqual(cpu.rooms.get('HIVE01')?.game?.pile, [1, 2]);
  assert.equal(cpu.scheduled.has('HIVE01:cpu-turn'), false);
});

test('a countdown entering play queues exactly one domain-selected CPU turn', () => {
  const fixture = createFixture();
  const source = playingRoom({ phase: 'focus' });
  source.players.host.hand = [3];
  source.players.guest.hand = [4];
  source.players.cpu.hand = [2];
  fixture.rooms.save(source, 0);
  assert.equal(fixture.game.setPlayerReady({ roomCode: 'HIVE01', playerId: 'host', ready: true }).ok, true);
  assert.equal(fixture.game.setPlayerReady({ roomCode: 'HIVE01', playerId: 'guest', ready: true }).ok, true);
  const countdown = fixture.scheduled.get('HIVE01:countdown-expired')!;
  fixture.scheduled.delete('HIVE01:countdown-expired');
  fixture.setNow(countdown.dueAt);
  assert.equal(fixture.effects.materialize(countdown).ok, true);
  assert.equal(fixture.scheduled.get('HIVE01:cpu-turn')?.expectedVersion, fixture.rooms.get('HIVE01')?.version);
});
