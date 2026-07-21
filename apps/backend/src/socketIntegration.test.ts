import assert from 'node:assert/strict';
import test from 'node:test';
import {
  closeIntegration,
  createClient,
  emitWithAck,
  startIntegrationServer,
  stopIntegrationServer,
  waitForEvent,
  type TestClient,
} from './socketIntegrationSupport.js';

type Snapshot = {
  version: number;
  publicState: {
    code: string;
    players: Array<{ id: string; handCount: number; socketId?: string; hand?: number[] }>;
    game: null | {
      phase: string;
      currentLevel: number;
      maxLevel: number;
      lives: number;
      stars: number;
      pile: number[];
      interactionLock: null | { reason: string };
      starProposal: null | { initiatorId: string; acceptedBy: string[] };
      finalResults: unknown[] | null;
    };
  };
  privateState: { hand: number[]; availableActions: unknown[] };
};

type CreateAck = { ok: boolean; snapshot: Snapshot; room: { code: string } };

type Ack = { ok: boolean; error?: string };

test.after(async () => stopIntegrationServer());

async function createRoom(url: string, clients: TestClient[]) {
  const host = await createClient(url);
  clients.push(host);
  const created = await emitWithAck<CreateAck>(host, 'room:create', { playerName: 'Host', playerId: 'host-0001' });
  const guest = await createClient(url);
  clients.push(guest);
  const joined = await emitWithAck<Ack>(guest, 'room:join', {
    roomCode: created.room.code,
    playerName: 'Guest',
    playerId: 'guest-001',
  });
  assert.equal(joined.ok, true);
  return { host, guest, roomCode: created.room.code };
}

async function resync(client: TestClient): Promise<Snapshot> {
  const result = await emitWithAck<{ ok: boolean; snapshot: Snapshot }>(client, 'room:resync');
  assert.equal(result.ok, true);
  return result.snapshot;
}

async function startPlaying(host: TestClient, guest: TestClient): Promise<void> {
  const started = await emitWithAck<Ack>(host, 'game:start');
  assert.equal(started.ok, true);
  const readyAfterDeal = waitForEvent<Snapshot>(host, 'room:snapshot', (snapshot) => snapshot.publicState.game?.interactionLock === null);
  await readyAfterDeal;
  const playing = waitForEvent<Snapshot>(host, 'room:snapshot', (snapshot) => snapshot.publicState.game?.phase === 'playing');
  const hostReady = await emitWithAck<Ack>(host, 'player:ready', { ready: true });
  assert.ok(hostReady.ok || hostReady.error === "You are not part of this round's ready-up");
  assert.equal((await emitWithAck<Ack>(guest, 'player:ready', { ready: true })).ok, true);
  await playing;
}

async function completeCurrentLevel(host: TestClient, guest: TestClient): Promise<void> {
  while (true) {
    const [hostState, guestState] = await Promise.all([resync(host), resync(guest)]);
    const game = hostState.publicState.game;
    assert.ok(game);
    const cards = [
      ...hostState.privateState.hand.map((card) => ({ client: host, card })),
      ...guestState.privateState.hand.map((card) => ({ client: guest, card })),
    ].sort((left, right) => left.card - right.card);
    if (cards.length === 0) return;
    assert.equal((await emitWithAck<Ack>(cards[0].client, 'game:play-card', { card: cards[0].card })).ok, true);
    if (cards.length === 1) return;
  }
}

async function waitForSnapshot(client: TestClient, predicate: (snapshot: Snapshot) => boolean): Promise<Snapshot> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const snapshot = await resync(client);
    if (predicate(snapshot)) return snapshot;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error('Timed out waiting for room state');
}

async function readyRound(host: TestClient, guest: TestClient): Promise<void> {
  const playing = waitForEvent<Snapshot>(host, 'room:snapshot', (snapshot) => snapshot.publicState.game?.phase === 'playing');
  const [hostState, guestState] = await Promise.all([resync(host), resync(guest)]);
  for (const participant of [
    { client: host, hand: hostState.privateState.hand },
    { client: guest, hand: guestState.privateState.hand },
  ]) {
    if (participant.hand.length === 0) continue;
    const ready = await emitWithAck<Ack>(participant.client, 'player:ready', { ready: true });
    assert.ok(ready.ok || ready.error === 'The countdown is already running');
  }
  await playing;
}

async function playCurrentError(host: TestClient, guest: TestClient): Promise<void> {
  const [hostState, guestState] = await Promise.all([resync(host), resync(guest)]);
  const candidates = [
    { client: host, card: hostState.privateState.hand[0] },
    { client: guest, card: guestState.privateState.hand[0] },
  ].filter((candidate) => candidate.card !== undefined).sort((left, right) => right.card - left.card);
  assert.ok(candidates.length > 1, 'two players must retain cards to create an error');
  assert.equal((await emitWithAck<Ack>(candidates[0].client, 'game:play-card', { card: candidates[0].card })).ok, true);
}

test('current baseline: real Socket.IO create, join, resync and reconnect preserve privacy', async (t) => {
  const { url } = await startIntegrationServer();
  const clients: TestClient[] = [];
  t.after(async () => closeIntegration(clients));

  const host = await createClient(url);
  clients.push(host);
  const created = await emitWithAck<CreateAck>(host, 'room:create', { playerName: 'Host', playerId: 'host-0001' });
  assert.equal(created.ok, true);
  assert.equal(created.snapshot.publicState.players[0].handCount, 0);
  assert.equal('hand' in created.snapshot.publicState.players[0], false);
  assert.equal('socketId' in created.snapshot.publicState.players[0], false);

  const guest = await createClient(url);
  clients.push(guest);
  const joined = await emitWithAck<{ ok: boolean; snapshot: Snapshot }>(guest, 'room:join', {
    roomCode: created.room.code,
    playerName: 'Guest',
    playerId: 'guest-001',
  });
  assert.equal(joined.ok, true);
  assert.equal(joined.snapshot.privateState.hand.length, 0);
  assert.ok(Array.isArray(joined.snapshot.privateState.availableActions));

  const resync = await emitWithAck<{ ok: boolean; snapshot: Snapshot }>(guest, 'room:resync');
  assert.equal(resync.ok, true);
  assert.equal(resync.snapshot.version, joined.snapshot.version);

  const reconnect = await createClient(url);
  clients.push(reconnect);
  const rejoined = await emitWithAck<{ ok: boolean; reconnected?: boolean }>(reconnect, 'room:join', {
    roomCode: created.room.code,
    playerName: 'Guest renamed',
    playerId: 'guest-001',
  });
  assert.equal(rejoined.ok, true);
  assert.equal(rejoined.reconnected, true);
});

test('current baseline: transport rejects unbound clients and host kick remains lobby-only', async (t) => {
  const { url } = await startIntegrationServer();
  const clients: TestClient[] = [];
  t.after(async () => closeIntegration(clients));
  const stranger = await createClient(url);
  clients.push(stranger);
  assert.deepEqual(await emitWithAck<Ack>(stranger, 'room:leave'), { ok: false, error: 'You are not in a room' });
  assert.deepEqual(await emitWithAck<Ack>(stranger, 'room:resync'), { ok: false, error: 'You are not in a room' });
  assert.deepEqual(await emitWithAck<Ack>(stranger, 'game:start'), { ok: false, error: 'You are not in a room' });
  assert.deepEqual(await emitWithAck<Ack>(stranger, 'game:retry'), { ok: false, error: 'You are not in a room' });
  assert.deepEqual(await emitWithAck<Ack>(stranger, 'game:play-card', { card: 1 }), { ok: false, error: 'You are not in a room' });
  assert.deepEqual(await emitWithAck<Ack>(stranger, 'star:discard-animation-complete'), { ok: false, error: 'You are not in a room' });
  assert.deepEqual(await emitWithAck<Ack>(stranger, 'room:create', { playerName: '', playerId: 'bad' }), {
    ok: false,
    error: 'Invalid player name or identifier',
  });

  const { host, guest } = await createRoom(url, clients);
  const kicked = waitForEvent<{ message: string }>(guest, 'room:kicked');
  assert.equal((await emitWithAck<Ack>(host, 'room:kick', { targetPlayerId: 'guest-001' })).ok, true);
  assert.equal((await kicked).message, 'The host removed you from the room.');
});

test('invalid wire payloads are rejected without mutating state or disconnecting clients', async (t) => {
  const { url } = await startIntegrationServer();
  const clients: TestClient[] = [];
  t.after(async () => closeIntegration(clients));
  const host = await createClient(url);
  clients.push(host);

  assert.deepEqual(await emitWithAck<Ack>(host, 'room:create', null), { ok: false, error: 'Invalid player name or identifier' });
  const created = await emitWithAck<CreateAck>(host, 'room:create', { playerName: 'Host', playerId: 'host-0001' });
  assert.equal(created.ok, true);
  const before = await resync(host);

  assert.deepEqual(await emitWithAck<Ack>(host, 'player:ready', { ready: 'yes' }), { ok: false, error: 'Invalid ready state' });
  assert.deepEqual(await emitWithAck<Ack>(host, 'game:play-card', { card: '1' }), { ok: false, error: 'Invalid card' });
  const after = await resync(host);
  assert.equal(after.version, before.version);
  assert.equal(host.connected, true);
});

test('current baseline: start, ready, correct play, pause, resume, and error penalty use real sockets', async (t) => {
  const { url } = await startIntegrationServer();
  const clients: TestClient[] = [];
  t.after(async () => closeIntegration(clients));
  const { host, guest } = await createRoom(url, clients);

  assert.deepEqual(await emitWithAck<Ack>(guest, 'game:start'), { ok: false, error: 'Only the host can start the game' });
  await startPlaying(host, guest);
  const firstRound = await Promise.all([resync(host), resync(guest)]);
  const lowest = [
    { client: host, card: firstRound[0].privateState.hand[0] },
    { client: guest, card: firstRound[1].privateState.hand[0] },
  ].sort((left, right) => left.card - right.card)[0];
  assert.equal((await emitWithAck<Ack>(lowest.client, 'game:play-card', { card: lowest.card })).ok, true);

  const levelTwo = waitForEvent<Snapshot>(host, 'room:snapshot', (snapshot) => snapshot.publicState.game?.currentLevel === 2 && snapshot.publicState.game.interactionLock === null);
  const remaining = lowest.client === host ? guest : host;
  const remainingState = await resync(remaining);
  assert.equal((await emitWithAck<Ack>(remaining, 'game:play-card', { card: remainingState.privateState.hand[0] })).ok, true);
  await levelTwo;

  const playingAgain = waitForEvent<Snapshot>(host, 'room:snapshot', (snapshot) => snapshot.publicState.game?.phase === 'playing');
  assert.equal((await emitWithAck<Ack>(host, 'player:ready', { ready: true })).ok, true);
  assert.equal((await emitWithAck<Ack>(guest, 'player:ready', { ready: true })).ok, true);
  await playingAgain;

  const paused = waitForEvent<{ by: string }>(host, 'game:paused');
  assert.equal((await emitWithAck<Ack>(host, 'game:pause-request')).ok, true);
  assert.equal((await paused).by, 'host-0001');
  const resumed = waitForEvent<Snapshot>(host, 'room:snapshot', (snapshot) => snapshot.publicState.game?.phase === 'playing');
  assert.equal((await emitWithAck<Ack>(host, 'player:ready', { ready: true })).ok, true);
  assert.equal((await emitWithAck<Ack>(guest, 'player:ready', { ready: true })).ok, true);
  await resumed;

  const [hostState, guestState] = await Promise.all([resync(host), resync(guest)]);
  const errorPlay = hostState.privateState.hand[0] > guestState.privateState.hand[0]
    ? { client: host, card: hostState.privateState.hand[0] }
    : { client: guest, card: guestState.privateState.hand[0] };
  const penalty = waitForEvent<{ lifeLost: number; blockingCards: unknown[] }>(host, 'game:error-penalty');
  assert.equal((await emitWithAck<Ack>(errorPlay.client, 'game:play-card', { card: errorPlay.card })).ok, true);
  assert.equal((await penalty).lifeLost, 1);
  const afterPenalty = await waitForEvent<Snapshot>(host, 'room:snapshot', (snapshot) => snapshot.publicState.game?.phase === 'paused');
  assert.equal(afterPenalty.publicState.game?.lives, 1);
});

test('current baseline: star proposals vote, reject, cancel, and settle after animation acknowledgements', async (t) => {
  const { url } = await startIntegrationServer();
  const clients: TestClient[] = [];
  t.after(async () => closeIntegration(clients));
  const { host, guest } = await createRoom(url, clients);
  await startPlaying(host, guest);

  assert.equal((await emitWithAck<Ack>(host, 'star:propose')).ok, true);
  assert.equal((await emitWithAck<Ack>(guest, 'star:reject')).ok, true);
  assert.equal((await emitWithAck<Ack>(host, 'star:propose')).ok, true);
  assert.equal((await emitWithAck<Ack>(host, 'star:cancel')).ok, true);
  assert.equal((await emitWithAck<Ack>(host, 'star:propose')).ok, true);
  const used = waitForEvent<{ discarded: Array<{ playerId: string }> }>(host, 'game:star-used');
  assert.equal((await emitWithAck<Ack>(guest, 'star:accept')).ok, true);
  assert.equal((await used).discarded.length, 2);
  const beforeAck = await resync(host);
  assert.equal(beforeAck.publicState.game?.stars, 0);
  assert.equal(beforeAck.privateState.hand.length, 1);
  const settledEvent = waitForEvent<Snapshot>(host, 'room:snapshot', (snapshot) => snapshot.privateState.hand.length === 0);
  assert.equal((await emitWithAck<Ack>(host, 'star:discard-animation-complete')).ok, true);
  assert.equal((await emitWithAck<Ack>(guest, 'star:discard-animation-complete')).ok, true);
  await settledEvent;
  const roundComplete = await waitForEvent<Snapshot>(host, 'room:snapshot', (snapshot) => snapshot.publicState.game?.phase === 'round-complete');
  assert.equal(roundComplete.publicState.game?.phase, 'round-complete');
});

test('star settlement pauses for ready-up without emitting a pause-requested message', async (t) => {
  const { url } = await startIntegrationServer();
  const clients: TestClient[] = [];
  t.after(async () => closeIntegration(clients));
  const { host, guest } = await createRoom(url, clients);
  await startPlaying(host, guest);
  await completeCurrentLevel(host, guest);
  await waitForSnapshot(host, (snapshot) => snapshot.publicState.game?.currentLevel === 2 && snapshot.publicState.game.interactionLock === null);
  await readyRound(host, guest);

  const pausedMessages: unknown[] = [];
  host.on('game:paused', (payload) => pausedMessages.push(payload));
  assert.equal((await emitWithAck<Ack>(host, 'star:propose')).ok, true);
  const used = waitForEvent(host, 'game:star-used');
  assert.equal((await emitWithAck<Ack>(guest, 'star:accept')).ok, true);
  await used;
  assert.equal((await emitWithAck<Ack>(host, 'star:discard-animation-complete')).ok, true);
  assert.equal((await emitWithAck<Ack>(guest, 'star:discard-animation-complete')).ok, true);

  const paused = await waitForSnapshot(host, (snapshot) => snapshot.publicState.game?.phase === 'paused');
  assert.equal(paused.publicState.game?.phase, 'paused');
  assert.deepEqual(pausedMessages, []);
});

test('current baseline: error overlays end in defeat and host retry resets the same room', async (t) => {
  const { url } = await startIntegrationServer();
  const clients: TestClient[] = [];
  t.after(async () => closeIntegration(clients));
  const { host, guest, roomCode } = await createRoom(url, clients);
  await startPlaying(host, guest);
  await completeCurrentLevel(host, guest);
  await waitForSnapshot(host, (snapshot) => snapshot.publicState.game?.currentLevel === 2 && snapshot.publicState.game.interactionLock === null);
  await readyRound(host, guest);

  for (let remainingLives = 2; remainingLives > 0; remainingLives -= 1) {
    while (true) {
      const [hostState, guestState] = await Promise.all([resync(host), resync(guest)]);
      if (hostState.privateState.hand.length > 0 && guestState.privateState.hand.length > 0) break;
      await completeCurrentLevel(host, guest);
      const currentLevel = hostState.publicState.game?.currentLevel ?? 0;
      await waitForSnapshot(host, (snapshot) => snapshot.publicState.game?.currentLevel === currentLevel + 1 && snapshot.publicState.game.interactionLock === null);
      await readyRound(host, guest);
    }

    await playCurrentError(host, guest);
    if (remainingLives > 1) {
      await waitForSnapshot(host, (snapshot) => snapshot.publicState.game?.phase === 'paused');
      await readyRound(host, guest);
    }
  }

  const defeated = await waitForSnapshot(host, (snapshot) => snapshot.publicState.game?.phase === 'game-over');
  assert.ok(defeated.publicState.game?.finalResults);
  assert.deepEqual(await emitWithAck<Ack>(guest, 'game:retry'), { ok: false, error: 'Only the host can retry' });
  const restarted = waitForEvent<{ message: string }>(host, 'game:restarted');
  assert.equal((await emitWithAck<Ack>(host, 'game:retry')).ok, true);
  assert.equal((await restarted).message, 'Game restarted in the same room.');
  const retried = await resync(host);
  assert.equal(retried.publicState.code, roomCode);
  assert.equal(retried.publicState.game?.currentLevel, 1);
  assert.equal(retried.publicState.game?.lives, 2);
});

test('current baseline: ordered play reaches victory across every level', async (t) => {
  const { url } = await startIntegrationServer();
  const clients: TestClient[] = [];
  t.after(async () => closeIntegration(clients));
  const { host, guest } = await createRoom(url, clients);
  await startPlaying(host, guest);

  for (let level = 1; level <= 12; level += 1) {
    await completeCurrentLevel(host, guest);
    if (level === 12) break;
    await waitForSnapshot(host, (snapshot) => snapshot.publicState.game?.currentLevel === level + 1 && snapshot.publicState.game.interactionLock === null);
    await readyRound(host, guest);
  }

  const victory = await waitForSnapshot(host, (snapshot) => snapshot.publicState.game?.phase === 'victory');
  assert.equal(victory.publicState.game?.currentLevel, 12);
  assert.ok(victory.publicState.game?.finalResults);
});
