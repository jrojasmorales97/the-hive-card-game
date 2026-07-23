import assert from 'node:assert/strict';
import test from 'node:test';
import type { ApplicationRoom } from '../../application/model.js';
import { RoomPresenter } from './roomPresenter.js';
import { SessionRegistry } from './sessionRegistry.js';
import { SocketEventPublisher } from './socketEventPublisher.js';

test('socket publisher materializes one committed room event once in public and private channels', () => {
  const calls: Array<{ target: string; event: string; payload: unknown }> = [];
  const io = {
    to: (target: string) => ({ emit: (event: string, payload: unknown) => calls.push({ target, event, payload }) }),
    sockets: { sockets: new Map() },
  } as never;
  const room: ApplicationRoom = {
    code: 'ROOM01', displayCode: 'ROOM01', shareable: true, hostId: 'host', status: 'lobby', version: 1, game: null, logs: [],
    players: { host: { id: 'host', name: 'Host', connected: true, ready: false, hand: [3] } },
  };
  const sessions = new SessionRegistry();
  sessions.bind('socket-host', 'host', room.code);
  const clock = { now: () => 100 };
  const publisher = new SocketEventPublisher(io, (code) => code === room.code ? room as never : undefined, sessions, new RoomPresenter(clock), clock);

  publisher.publish({ type: 'room-joined', roomCode: room.code, playerId: 'host', playerName: 'Host' });

  assert.deepEqual(calls.map((call) => call.event), ['room:update', 'player:state', 'room:snapshot', 'game:log']);
  assert.equal(calls.filter((call) => call.event === 'room:update').length, 1);
  assert.equal(JSON.stringify(calls.find((call) => call.event === 'room:update')?.payload).includes('[3]'), false);
  assert.deepEqual((calls.find((call) => call.event === 'player:state')?.payload as { privateState: { hand: number[] } }).privateState.hand, [3]);
});

test('manual pause publishes snapshot, pause notification, and log in wire order', () => {
  const calls: Array<{ target: string; event: string; payload: unknown }> = [];
  const io = {
    to: (target: string) => ({ emit: (event: string, payload: unknown) => calls.push({ target, event, payload }) }),
    sockets: { sockets: new Map() },
  } as never;
  const room: ApplicationRoom = {
    code: 'ROUND01', displayCode: 'ROUND01', shareable: true, hostId: 'host', status: 'in-game', version: 3, logs: [],
    game: { phase: 'paused', currentLevel: 1, maxLevel: 12, lives: 2, stars: 1, pile: [], pileHistory: [], lastPlayed: null, rewardMap: {}, mode: 'normal', starProposal: null, interactionLock: null, startedAt: 0, errorCounts: {}, finalResults: null },
    players: { host: { id: 'host', name: 'Host', connected: true, ready: false, hand: [3] } },
  };
  const sessions = new SessionRegistry();
  sessions.bind('socket-host', 'host', room.code);
  const clock = { now: () => 100 };
  const publisher = new SocketEventPublisher(io, (code) => code === room.code ? room as never : undefined, sessions, new RoomPresenter(clock), clock);

  publisher.publish({ type: 'game-paused', roomCode: room.code, playerId: 'host' });

  assert.deepEqual(calls.map((call) => call.event), ['room:update', 'player:state', 'room:snapshot', 'game:paused', 'game:log']);
  assert.deepEqual(calls[3]?.payload, { version: 3, by: 'host' });
  assert.equal(room.logs[0]?.type, 'game:paused');
});
