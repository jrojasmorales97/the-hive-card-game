import { io, type Socket } from 'socket.io-client';
import { test, expect, action, play } from './fixtures';

// Supplemental wire assertions for actions that have no UI (kick, malformed commands,
// non-minimum card). Every scenario also observes the actual browser client.
const peers: Socket[] = [];
test.afterEach(() => { for (const peer of peers.splice(0)) peer.disconnect(); });
async function peer(code: string, index: number) {
  const socket = io('http://127.0.0.1:3002', { transports: ['websocket'], forceNew: true }); peers.push(socket);
  await new Promise<void>(resolve => socket.on('connect', () => resolve()));
  const response = await socket.timeout(3000).emitWithAck('room:join', { roomCode: code, playerId: `${code}-player-${index}`, playerName: index === 0 ? 'Alice' : `Player ${index + 1}` });
  expect(response.ok).toBe(true); return socket;
}
const emit = (socket: Socket, event: string, payload?: unknown) => payload === undefined ? socket.timeout(3000).emitWithAck(event) : socket.timeout(3000).emitWithAck(event, payload);

test('private hands never appear in public snapshots; resync is read-only', async ({ page, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]] }); await match.open(page);
  const other = await peer(match.code, 1);
  const before = await match.state(); const response = await emit(other, 'room:resync');
  expect(response.snapshot.privateState.hand).toEqual([20, 90]);
  for (const player of response.snapshot.publicState.players) { expect(player).not.toHaveProperty('hand'); expect(player).not.toHaveProperty('socketId'); }
  expect((await match.state()).version).toBe(before.version);
  await expect(page.getByTitle('Play this card')).toContainText('10');
});

for (const [event, payload] of [['game:play-card', { card: 90 }], ['game:play-card', { card: 99 }], ['game:play-card', { card: '20' }], ['game:start', undefined], ['game:retry', undefined], ['star:accept', undefined], ['star:cancel', undefined], ['star:reject', undefined], ['room:kick', { targetPlayerId: 'absent' }]] as const) test(`reject ${event} ${JSON.stringify(payload)}`, async ({ page, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]] }); await match.open(page); const other = await peer(match.code, 1);
  const before = await match.state(); expect((await emit(other, event, payload)).ok).toBe(false);
  expect(await match.state()).toEqual(before); await expect(page.getByTitle('Play this card')).toBeEnabled();
});

test('ready and unready quorum; lock rejects playing and duplicate readiness', async ({ page, match }) => {
  await match.seed({ hands: [[10], [20]], phase: 'focus' }); await match.open(page); const other = await peer(match.code, 1);
  expect((await emit(other, 'player:ready', { ready: true })).ok).toBe(true);
  expect((await emit(other, 'player:ready', { ready: false })).ok).toBe(true);
  await action(page, 'Ready').click(); expect((await match.state()).game.phase).toBe('focus');
  expect((await emit(other, 'game:play-card', { card: 20 })).ok).toBe(false);
  expect((await emit(other, 'player:ready', { ready: true })).ok).toBe(true);
  expect((await emit(other, 'player:ready', { ready: false })).ok).toBe(false);
  await expect(action(page, 'Pause')).toBeEnabled();
});

test('host kicks a player from lobby and their browser returns to access', async ({ page, match }) => {
  await match.seed({ hands: [[], []], lobby: true }); await match.open(page, 1); const host = await peer(match.code, 0);
  expect((await emit(host, 'room:kick', { targetPlayerId: `${match.code}-player-1` })).ok).toBe(true);
  await expect(page.getByRole('tab', { name: 'Join room' })).toBeVisible();
});

test('guest cannot start and strangers cannot join a running game', async ({ page, match }) => {
  await match.seed({ hands: [[], []], lobby: true }); await match.open(page); const guest = await peer(match.code, 1);
  expect((await emit(guest, 'game:start')).ok).toBe(false); await action(page, 'Start').click();
  const stranger = io('http://127.0.0.1:3002', { transports: ['websocket'] }); peers.push(stranger);
  const response = await emit(stranger, 'room:join', { roomCode: match.code, playerId: 'stranger-player', playerName: 'Stranger' });
  expect(response.ok).toBe(false); await expect(action(page, 'Ready')).toBeEnabled();
});

test('playing a card clears an outstanding star proposal without consuming it', async ({ page, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]] }); await match.open(page); const other = await peer(match.code, 1);
  expect((await emit(other, 'star:propose')).ok).toBe(true); await play(page);
  await expect(action(page, 'Propose star')).toBeEnabled();
  expect((await match.state()).game.starProposal).toBeNull(); expect((await match.state()).game.stars).toBe(1);
});

test('star settles on timeout if a connected peer never acknowledges animation', async ({ page, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]] }); await match.open(page); const other = await peer(match.code, 1);
  await action(page, 'Propose star').click(); expect((await emit(other, 'star:accept')).ok).toBe(true);
  await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
  expect((await emit(other, 'star:discard-animation-complete')).ok).toBe(true);
  expect((await emit(other, 'star:discard-animation-complete')).ok).toBe(true);
  expect(Object.values((await match.state()).players).map((p: any) => p.hand)).toEqual([[80], [90]]);
  await expect(action(page, 'Ready')).toBeEnabled();
});

test('disconnect of the last pending voter resolves consensus without inventing a vote', async ({ page, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]] }); await match.open(page); const other = await peer(match.code, 1);
  await action(page, 'Propose star').click(); other.disconnect();
  await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
  expect((await match.state()).game.stars).toBe(0);
  expect(Object.values((await match.state()).players).map((p: any) => p.hand)).toEqual([[80], [90]]);
  await expect(action(page, 'Ready')).toBeEnabled();
});

test('leaving during star settlement releases the remaining browser', async ({ page, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]] }); await match.open(page); const other = await peer(match.code, 1);
  await action(page, 'Propose star').click(); await emit(other, 'star:accept'); await emit(other, 'room:leave');
  await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
  await expect(action(page, 'Ready')).toBeEnabled();
});

test('test controls are absent from the game HTTP server', async ({ request }) => {
  expect((await request.post('http://127.0.0.1:3002/rooms', { data: {} })).status()).toBe(404);
});
