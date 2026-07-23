import assert from 'node:assert/strict';
import test from 'node:test';

import { InMemoryRoomRepository } from '../infrastructure/memory/inMemoryRoomRepository.js';
import { EffectUseCases } from './effectUseCases.js';
import type { ApplicationRoom } from './model.js';
import type { ApplicationEffect, ApplicationEvent } from './result.js';
import { RoomUseCases } from './roomUseCases.js';
import { StarUseCases } from './starUseCases.js';

function playingRoom(): ApplicationRoom {
  return {
    code: 'STAR01', displayCode: 'STAR01', shareable: true, hostId: 'host', status: 'in-game', version: 0, logs: [],
    players: {
      host: { id: 'host', name: 'Host', connected: true, ready: false, hand: [2] },
      guest: { id: 'guest', name: 'Guest', connected: true, ready: false, hand: [4] },
      empty: { id: 'empty', name: 'Empty', connected: true, ready: false, hand: [] },
      offline: { id: 'offline', name: 'Offline', connected: false, ready: false, hand: [5] },
      cpu: { id: 'cpu', name: 'CPU', connected: true, ready: false, hand: [1], isCpu: true },
    },
    game: {
      phase: 'playing', currentLevel: 1, maxLevel: 2, lives: 2, stars: 1, pile: [], pileHistory: [], lastPlayed: null,
      rewardMap: { 1: 'life' }, mode: 'dev-cpu', starProposal: null, interactionLock: null, startedAt: 0, errorCounts: {}, finalResults: null,
    },
  };
}

function fixture() {
  const rooms = new InMemoryRoomRepository();
  const events: ApplicationEvent[] = [];
  const scheduled = new Map<string, ApplicationEffect>();
  let now = 100;
  const dependencies = {
    rooms,
    publisher: { publish: (event: ApplicationEvent) => events.push(event) },
    scheduler: {
      schedule: (roomCode: string, key: string, effect: ApplicationEffect) => scheduled.set(`${roomCode}:${key}`, effect),
      cancel: (roomCode: string, key: string) => scheduled.delete(`${roomCode}:${key}`),
      cancelRoom: (roomCode: string) => { for (const key of scheduled.keys()) if (key.startsWith(`${roomCode}:`)) scheduled.delete(key); },
    },
    clock: { now: () => now },
  };
  const stars = new StarUseCases({ ...dependencies, resolutionMs: () => 50, roundFlipMs: () => 10, cpuDelay: () => 9 });
  const effects = new EffectUseCases({
    ...dependencies,
    countdownMs: 20,
    random: { next: () => 0.999 },
    cardDurations: () => ({ errorOverlayMs: 50, roundFlipMs: 10, roundUnflipMs: 10 }),
    levelCompleteMs: () => 50,
    dealingDuration: () => 10,
    cpuDelay: () => 9,
    retryBannerMs: 50,
  });
  return { rooms, events, scheduled, stars, effects, setNow: (value: number) => { now = value; } };
}

test('star proposal preserves consensus and settlement populations without touching hands before settlement', () => {
  const state = fixture();
  const source = playingRoom();
  state.rooms.save(source, 0);

  assert.equal(state.stars.proposeStar({ roomCode: source.code, playerId: 'host' }).ok, true);
  const proposed = state.rooms.get(source.code)!;
  assert.deepEqual(Array.from(proposed.game?.starProposal?.acceptedBy ?? []).sort(), ['cpu', 'host']);
  assert.deepEqual(proposed.players.host.hand, [2]);
  assert.equal(state.stars.acceptStar({ roomCode: source.code, playerId: 'host' }).ok, true, 'repeated vote is a no-op');
  assert.equal(state.stars.acceptStar({ roomCode: source.code, playerId: 'guest' }).ok, true);
  assert.equal(state.stars.acceptStar({ roomCode: source.code, playerId: 'empty' }).ok, true);

  const resolving = state.rooms.get(source.code)!;
  assert.equal(resolving.game?.stars, 0);
  assert.deepEqual(resolving.players.offline.hand, [5], 'offline non-empty hands are previewed but never wait for a socket');
  assert.deepEqual(resolving.starSettlement?.awaitingPlayerIds.sort(), ['guest', 'host']);
  assert.equal(state.events.filter((event) => event.type === 'game-star-used').length, 1);
  assert.equal(state.stars.cancelStar({ roomCode: source.code, playerId: 'host' }).ok, false, 'star lock cannot be cancelled');
});

test('acknowledgements, disconnect-equivalent completion and deadline converge on one settlement', () => {
  const state = fixture();
  state.rooms.save(playingRoom(), 0);
  assert.equal(state.stars.proposeStar({ roomCode: 'STAR01', playerId: 'host' }).ok, true);
  assert.equal(state.stars.acceptStar({ roomCode: 'STAR01', playerId: 'guest' }).ok, true);
  assert.equal(state.stars.acceptStar({ roomCode: 'STAR01', playerId: 'empty' }).ok, true);

  const original = state.scheduled.get('STAR01:star-settled')!;
  assert.equal(state.effects.materialize(original).ok, false, 'deadline cannot settle while visual acks remain');
  assert.equal(state.stars.completeStarAnimation({ roomCode: 'STAR01', playerId: 'host' }).ok, true);
  const partial = state.rooms.get('STAR01')!;
  assert.deepEqual(partial.players.host.hand, [2]);
  assert.equal(state.stars.completeStarAnimation({ roomCode: 'STAR01', playerId: 'host' }).ok, true, 'duplicate ack is inert');
  assert.equal(state.stars.completeStarAnimation({ roomCode: 'STAR01', playerId: 'guest' }).ok, true);
  const immediate = state.scheduled.get('STAR01:star-settled')!;
  assert.equal(state.effects.materialize(immediate).ok, true);
  const settled = state.rooms.get('STAR01')!;
  assert.equal(settled.starSettlement, null);
  assert.deepEqual(settled.players.host.hand, []);
  assert.deepEqual(settled.players.guest.hand, []);
  assert.deepEqual(settled.players.offline.hand, []);
  assert.equal(state.effects.materialize(immediate).ok, false, 'stale callback cannot consume a second hand');

  const timeout = fixture();
  timeout.rooms.save(playingRoom(), 0);
  timeout.stars.proposeStar({ roomCode: 'STAR01', playerId: 'host' });
  timeout.stars.acceptStar({ roomCode: 'STAR01', playerId: 'guest' });
  timeout.stars.acceptStar({ roomCode: 'STAR01', playerId: 'empty' });
  const deadline = timeout.scheduled.get('STAR01:star-settled')!;
  timeout.setNow(deadline.dueAt);
  assert.equal(timeout.effects.materialize(deadline).ok, true);
  assert.equal(timeout.rooms.get('STAR01')?.players.cpu.hand.length, 0);
});

test('cancel and reject only clear the proposal, dispatch a room update, and can resume a CPU turn', () => {
  const state = fixture();
  state.rooms.save(playingRoom(), 0);
  assert.equal(state.stars.proposeStar({ roomCode: 'STAR01', playerId: 'host' }).ok, true);
  assert.equal(state.stars.rejectStar({ roomCode: 'STAR01', playerId: 'guest' }).ok, true);
  assert.equal(state.rooms.get('STAR01')?.game?.starProposal, null);
  assert.ok(state.scheduled.has('STAR01:cpu-turn'));
  assert.ok(state.events.some((event) => event.type === 'room-updated'));
  assert.deepEqual(state.stars.rejectStar({ roomCode: 'STAR01', playerId: 'guest' }), {
    ok: false, error: { code: 'invalid-state', message: 'There is no active star proposal' },
  });
});

test('an active disconnect closes only that visual wait and settlement still uses its preserved hand', () => {
  const state = fixture();
  state.rooms.save(playingRoom(), 0);
  state.stars.proposeStar({ roomCode: 'STAR01', playerId: 'host' });
  state.stars.acceptStar({ roomCode: 'STAR01', playerId: 'guest' });
  state.stars.acceptStar({ roomCode: 'STAR01', playerId: 'empty' });
  const rooms = new RoomUseCases({
    rooms: state.rooms,
    publisher: { publish: (event) => state.events.push(event) },
    scheduler: {
      schedule: (roomCode, key, effect) => state.scheduled.set(`${roomCode}:${key}`, effect),
      cancel: (roomCode, key) => state.scheduled.delete(`${roomCode}:${key}`),
      cancelRoom: () => undefined,
    },
    random: { next: () => 0 },
  });
  assert.equal(rooms.disconnectPlayer({ roomCode: 'STAR01', playerId: 'guest' }).ok, true);
  assert.deepEqual(state.rooms.get('STAR01')?.players.guest.hand, [4]);
  assert.equal(state.stars.completeStarAnimation({ roomCode: 'STAR01', playerId: 'guest' }).ok, true);
  assert.equal(state.stars.completeStarAnimation({ roomCode: 'STAR01', playerId: 'host' }).ok, true);
  assert.equal(state.effects.materialize(state.scheduled.get('STAR01:star-settled')!).ok, true);
  assert.deepEqual(state.rooms.get('STAR01')?.players.guest.hand, []);
});
