import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryRoomRepository } from '../infrastructure/memory/inMemoryRoomRepository.js';
import type { ApplicationRoom } from './model.js';
import type { ApplicationEvent, ApplicationEffect } from './result.js';
import { GameUseCases } from './gameUseCases.js';

function room(): ApplicationRoom {
  return {
    code: 'HIVE01', displayCode: 'HIVE01', shareable: true, hostId: 'host', status: 'lobby', version: 0, logs: [], game: null,
    players: {
      host: { id: 'host', name: 'Host', connected: true, ready: true, hand: [] },
      guest: { id: 'guest', name: 'Guest', connected: true, ready: false, hand: [] },
    },
  };
}

function fixture(now = 100) {
  const rooms = new InMemoryRoomRepository();
  const events: ApplicationEvent[] = [];
  const scheduled = new Map<string, ApplicationEffect>();
  let randomCalls = 0;
  const useCases = new GameUseCases({
    rooms,
    publisher: { publish: (event) => events.push(event) },
    scheduler: {
      schedule: (roomCode, key, effect) => scheduled.set(`${roomCode}:${key}`, effect),
      cancel: (roomCode, key) => scheduled.delete(`${roomCode}:${key}`),
      cancelRoom: (roomCode) => { for (const key of scheduled.keys()) if (key.startsWith(`${roomCode}:`)) scheduled.delete(key); },
    },
    clock: { now: () => now },
    random: { next: () => { randomCalls += 1; return 0.999; } },
    dealingDuration: (level) => level * 10,
    countdownDuration: () => 20,
    retryBannerMs: 50,
    cardDurations: () => ({ errorOverlayMs: 50, roundFlipMs: 10, roundUnflipMs: 10 }),
    cpuDelay: () => 9,
  });
  return { rooms, events, scheduled, useCases, randomCalls: () => randomCalls };
}

test('startGame commits one deterministic shuffled setup and dispatches its ordered effect once', () => {
  const { rooms, events, scheduled, useCases, randomCalls } = fixture();
  const source = room();
  rooms.save(source, 0);

  const result = useCases.startGame({ roomCode: source.code, playerId: 'host' });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(source, room());
  assert.equal(result.data.room.version, 1);
  assert.deepEqual(result.data.room.players.host.hand, [1]);
  assert.deepEqual(result.data.room.players.guest.hand, [2]);
  assert.equal(randomCalls(), 99);
  assert.deepEqual(events, [{ type: 'game-started', roomCode: 'HIVE01', startedAt: 100 }]);
  assert.deepEqual([...scheduled.keys()], ['HIVE01:dealing-expired']);
  assert.equal(scheduled.get('HIVE01:dealing-expired')?.expectedVersion, 1);
});

test('retry resets the terminal game, replaces dealing work, and keeps literal authorization errors', () => {
  const { rooms, events, scheduled, useCases, randomCalls } = fixture();
  rooms.save(room(), 0);
  const denied = useCases.startGame({ roomCode: 'HIVE01', playerId: 'guest' });
  assert.deepEqual(denied, { ok: false, error: { code: 'forbidden', message: 'Only the host can start the game' } });
  assert.equal(events.length, 0);
  assert.equal(scheduled.size, 0);

  const started = useCases.startGame({ roomCode: 'HIVE01', playerId: 'host' });
  assert.equal(started.ok, true);
  const firstEffect = scheduled.get('HIVE01:dealing-expired');
  const terminal = rooms.get('HIVE01')!;
  terminal.game!.phase = 'game-over';
  terminal.game!.interactionLock = null;
  rooms.save(terminal, terminal.version);

  const retried = useCases.retryGame({ roomCode: 'HIVE01', playerId: 'host' });
  assert.equal(retried.ok, true);
  if (!retried.ok) return;
  assert.equal(retried.data.room.players.host.ready, false);
  assert.equal(retried.data.room.players.guest.ready, false);
  assert.equal(retried.data.room.game?.interactionLock?.until, 150);
  assert.equal(randomCalls(), 198);
  assert.deepEqual(events.map((event) => event.type), ['game-started', 'game-restarted']);
  assert.notEqual(scheduled.get('HIVE01:dealing-expired')?.expectedVersion, firstEffect?.expectedVersion);
});

function activeRoundRoom(): ApplicationRoom {
  return {
    code: 'ROUND01', displayCode: 'ROUND01', shareable: true, hostId: 'host', status: 'in-game', version: 0, logs: [],
    players: {
      host: { id: 'host', name: 'Host', connected: true, ready: false, hand: [8] },
      guest: { id: 'guest', name: 'Guest', connected: true, ready: false, hand: [4] },
      empty: { id: 'empty', name: 'Empty', connected: true, ready: true, hand: [] },
      cpu: { id: 'cpu', name: 'CPU', connected: true, ready: false, hand: [6], isCpu: true },
    },
    game: {
      phase: 'focus', currentLevel: 2, maxLevel: 12, lives: 2, stars: 1, pile: [], pileHistory: [], lastPlayed: null,
      rewardMap: {}, mode: 'dev-cpu', starProposal: null, interactionLock: null, startedAt: 0, errorCounts: {}, finalResults: null,
    },
  };
}

test('ready commits the canonical quorum once, ignores empty hands, and dispatches only its declared work', () => {
  const { rooms, events, scheduled, useCases } = fixture();
  rooms.save(activeRoundRoom(), 0);

  const first = useCases.setPlayerReady({ roomCode: 'ROUND01', playerId: 'host', ready: true });
  assert.equal(first.ok, true);
  assert.equal(rooms.get('ROUND01')?.players.cpu.ready, true);
  assert.equal(rooms.get('ROUND01')?.game?.interactionLock, null);
  assert.deepEqual(events.map((event) => event.type), ['room-updated']);
  assert.equal(scheduled.size, 0);

  const second = useCases.setPlayerReady({ roomCode: 'ROUND01', playerId: 'guest', ready: true });
  assert.equal(second.ok, true);
  assert.equal(rooms.get('ROUND01')?.game?.interactionLock?.reason, 'countdown');
  assert.deepEqual([...scheduled.keys()], ['ROUND01:countdown-expired']);
  assert.deepEqual(events.map((event) => event.type), ['room-updated', 'room-updated']);

  const before = rooms.get('ROUND01')!;
  const denied = useCases.setPlayerReady({ roomCode: 'ROUND01', playerId: 'empty', ready: true });
  assert.deepEqual(denied, { ok: false, error: { code: 'invalid-state', message: 'The countdown is already running' } });
  assert.deepEqual(rooms.get('ROUND01'), before);
  assert.equal(events.length, 2);
  assert.equal(scheduled.size, 1);
});

test('manual pause preserves the pause population and is the only path that emits game-paused', () => {
  const { rooms, events, scheduled, useCases } = fixture();
  const source = activeRoundRoom();
  source.game!.phase = 'playing';
  source.players.host.ready = true;
  source.players.guest.ready = true;
  rooms.save(source, 0);

  const paused = useCases.requestPause({ roomCode: 'ROUND01', playerId: 'host' });
  assert.equal(paused.ok, true);
  const saved = rooms.get('ROUND01')!;
  assert.equal(saved.game?.phase, 'paused');
  assert.equal(saved.players.host.ready, false);
  assert.equal(saved.players.guest.ready, false);
  assert.equal(saved.players.empty.ready, true);
  assert.equal(saved.players.cpu.ready, true);
  assert.deepEqual(events, [{ type: 'game-paused', roomCode: 'ROUND01', playerId: 'host' }]);
  assert.equal(scheduled.size, 0);

  const before = structuredClone(saved);
  const denied = useCases.requestPause({ roomCode: 'ROUND01', playerId: 'guest' });
  assert.deepEqual(denied, { ok: false, error: { code: 'invalid-state', message: 'You can only pause during active play' } });
  assert.deepEqual(rooms.get('ROUND01'), before);
  assert.equal(events.length, 1);
});

function playingCardRoom(): ApplicationRoom {
  const source = activeRoundRoom();
  source.game!.phase = 'playing';
  source.game!.currentLevel = 1;
  source.game!.maxLevel = 2;
  source.players.host.hand = [1];
  source.players.guest.hand = [3];
  source.players.cpu.hand = [2];
  return source;
}

test('playCard commits domain card facts once and schedules only a domain-selected CPU continuation', () => {
  const { rooms, events, scheduled, useCases } = fixture();
  rooms.save(playingCardRoom(), 0);

  const result = useCases.playCard({ roomCode: 'ROUND01', playerId: 'host', card: 1 });
  assert.equal(result.ok, true);
  assert.deepEqual(rooms.get('ROUND01')?.game?.pile, [1]);
  assert.deepEqual(events.map((event) => event.type), ['game-card-played', 'room-updated']);
  assert.equal(scheduled.get('ROUND01:cpu-turn')?.expectedVersion, 1);

  const before = rooms.get('ROUND01')!;
  const denied = useCases.playCard({ roomCode: 'ROUND01', playerId: 'guest', card: 2 });
  assert.deepEqual(denied, { ok: false, error: { code: 'invalid-state', message: 'You do not have that card' } });
  assert.deepEqual(rooms.get('ROUND01'), before);
});

test('playCard preserves ordered error facts, bounded penalty, and rejects CPU scheduling after error', () => {
  const { rooms, events, scheduled, useCases } = fixture();
  const source = playingCardRoom();
  source.players.host.hand = [4];
  source.players.guest.hand = [2];
  source.players.cpu.hand = [3];
  source.game!.lives = 1;
  rooms.save(source, 0);

  const result = useCases.playCard({ roomCode: 'ROUND01', playerId: 'host', card: 4 });
  assert.equal(result.ok, true);
  assert.equal(rooms.get('ROUND01')?.game?.lives, 0);
  assert.deepEqual(events.map((event) => event.type), [
    'game-card-played', 'game-error-penalty', 'game-card-discarded', 'game-card-discarded', 'room-updated',
  ]);
  assert.ok(scheduled.has('ROUND01:error-expired'));
  assert.equal(scheduled.has('ROUND01:cpu-turn'), false);
});
