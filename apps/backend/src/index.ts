import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';

type Player = {
  id: string;
  name: string;
  socketId: string | null;
  connected: boolean;
  ready: boolean;
  hand: number[];
  isCpu?: boolean;
};

type RewardType = 'life' | 'star';

type StarProposal = {
  initiatorId: string;
  acceptedBy: Set<string>;
};

type PileEntry = {
  value: number;
  playerId: string;
};

type GameState = {
  phase: 'focus' | 'playing' | 'paused' | 'round-complete' | 'level-complete' | 'game-over' | 'victory';
  currentLevel: number;
  maxLevel: number;
  lives: number;
  stars: number;
  pile: number[];
  pileHistory: PileEntry[];
  lastPlayed: number | null;
  rewardMap: Record<number, RewardType>;
  mode: 'normal' | 'dev-cpu';
  starProposal: StarProposal | null;
};

type Room = {
  code: string;
  displayCode?: string;
  shareable?: boolean;
  hostId: string;
  players: Record<string, Player>;
  status: 'lobby' | 'in-game';
  game: GameState | null;
  logs: Array<{
    id: string;
    ts: number;
    roomCode: string;
    type: string;
    payload: Record<string, unknown>;
  }>;
};

const rooms = new Map<string, Room>();
const playerRoom = new Map<string, string>();
const socketPlayer = new Map<string, string>();
const cpuPlayTimers = new Map<string, ReturnType<typeof setTimeout>>();
const levelCompleteTimers = new Map<string, ReturnType<typeof setTimeout>>();
let logSeq = 0;

const MAX_PLAYERS = 8;
const GAME_BALANCE: Record<number, { maxLevel: number; lives: number }> = {
  2: { maxLevel: 12, lives: 2 },
  3: { maxLevel: 10, lives: 3 },
  4: { maxLevel: 8, lives: 4 },
  5: { maxLevel: 8, lives: 4 },
  6: { maxLevel: 7, lives: 5 },
  7: { maxLevel: 6, lives: 5 },
  8: { maxLevel: 5, lives: 5 },
};

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const ALLOW_ALL_ORIGINS = CLIENT_ORIGIN.trim() === '*';
const DEV_CPU_PLAY_DELAY_MS = clampNumber(Number(process.env.DEV_CPU_PLAY_DELAY_MS ?? 900), 100, 10_000);
const STAR_RESOLVED_CPU_DELAY_MS = 3000;
const ROUND_COUNTDOWN_DELAY_MS = 3600;
const ROUND_OUT_FLIP_MS = 520;
const ROUND_OUT_UNFLIP_MS = 520;
const ERROR_OVERLAY_DELAY_MS = 4200;

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: ALLOW_ALL_ORIGINS ? true : CLIENT_ORIGIN,
  credentials: !ALLOW_ALL_ORIGINS,
});

app.get('/health', async () => ({ ok: true }));

const server = app.server;
const io = new Server(server, {
  cors: {
    origin: ALLOW_ALL_ORIGINS ? true : CLIENT_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: !ALLOW_ALL_ORIGINS,
  },
});

function generateRoomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function createUniqueRoomCode(): string {
  let code = generateRoomCode();
  while (rooms.has(code)) code = generateRoomCode();
  return code;
}

function serializeRoom(room: Room) {
  const players = Object.values(room.players).map((player) => ({
    id: player.id,
    name: player.name,
    connected: player.connected,
    ready: player.ready,
    handCount: player.hand.length,
    isCpu: player.isCpu,
  }));

  const game = room.game
    ? {
        phase: room.game.phase,
        currentLevel: room.game.currentLevel,
        maxLevel: room.game.maxLevel,
        lives: room.game.lives,
        stars: room.game.stars,
        pile: room.game.pile,
        pileHistory: room.game.pileHistory,
        lastPlayed: room.game.lastPlayed,
        mode: room.game.mode,
        starProposal: room.game.starProposal
          ? {
              initiatorId: room.game.starProposal.initiatorId,
              acceptedBy: Array.from(room.game.starProposal.acceptedBy),
            }
          : null,
      }
    : null;

  return {
    code: room.code,
    displayCode: room.displayCode ?? room.code,
    shareable: room.shareable ?? true,
    hostId: room.hostId,
    status: room.status,
    players,
    game,
    logs: room.logs,
  };
}

function emitRoomUpdate(code: string) {
  const room = rooms.get(code);
  if (!room) return;

  io.to(code).emit('room:update', serializeRoom(room));

  Object.values(room.players).forEach((player) => {
    if (!player.socketId) return;
    io.to(player.socketId).emit('player:state', {
      hand: [...player.hand].sort((a, b) => a - b),
    });
  });
}

function emitGameLog(roomCode: string, type: string, payload: Record<string, unknown> = {}) {
  const room = rooms.get(roomCode);
  const entry = {
    id: `${Date.now()}-${++logSeq}`,
    ts: Date.now(),
    roomCode,
    type,
    payload,
  };

  if (room) {
    room.logs.push(entry);
    if (room.logs.length > 50) room.logs = room.logs.slice(-50);
  }

  io.to(roomCode).emit('game:log', entry);
}

function getPlayerName(room: Room, playerId: string): string {
  return room.players[playerId]?.name ?? 'Jugador';
}

function maxLevelByPlayers(playerCount: number): number {
  return GAME_BALANCE[playerCount]?.maxLevel ?? GAME_BALANCE[MAX_PLAYERS].maxLevel;
}

function initialLivesByPlayers(playerCount: number): number {
  return GAME_BALANCE[playerCount]?.lives ?? GAME_BALANCE[MAX_PLAYERS].lives;
}

function buildRewardMap(maxLevel: number): Record<number, RewardType> {
  const rewards: Record<number, RewardType> = {
    2: 'star',
    3: 'life',
    5: 'star',
    6: 'life',
    8: 'star',
    9: 'life',
  };

  return Object.fromEntries(
    Object.entries(rewards).filter(([level]) => Number(level) <= maxLevel),
  ) as Record<number, RewardType>;
}

function buildDeck(): number[] {
  const deck = Array.from({ length: 100 }, (_, index) => index + 1);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function isDevCpuRoom(room: Room): boolean {
  return Object.values(room.players).some((player) => player.isCpu);
}

function gameModeForRoom(room: Room): GameState['mode'] {
  return isDevCpuRoom(room) ? 'dev-cpu' : 'normal';
}

function getHumanPlayers(room: Room): Player[] {
  return Object.values(room.players).filter((player) => !player.isCpu);
}

function markCpuPlayersReady(room: Room) {
  if (!isDevCpuRoom(room)) return;

  Object.values(room.players).forEach((player) => {
    if (player.isCpu) {
      player.connected = true;
      player.ready = true;
    }
  });
}

function clearCpuTurn(roomCode: string) {
  const timer = cpuPlayTimers.get(roomCode);
  if (!timer) return;

  clearTimeout(timer);
  cpuPlayTimers.delete(roomCode);
}

function clearLevelCompleteTimer(roomCode: string) {
  const timer = levelCompleteTimers.get(roomCode);
  if (!timer) return;

  clearTimeout(timer);
  levelCompleteTimers.delete(roomCode);
}

function findGlobalLowestCard(room: Room): { player: Player; card: number } | null {
  return Object.values(room.players).reduce<{ player: Player; card: number } | null>((lowest, player) => {
    if (player.hand.length === 0) return lowest;

    const card = Math.min(...player.hand);
    if (!lowest || card < lowest.card) return { player, card };
    return lowest;
  }, null);
}

function isRoundParticipationPhase(room: Room): boolean {
  return room.game?.phase === 'playing' || room.game?.phase === 'paused';
}

function isActiveRoundParticipant(room: Room, player: Player): boolean {
  if (!player.connected) return false;
  if (!isRoundParticipationPhase(room)) return true;
  return player.hand.length > 0;
}

function getActiveRoundParticipants(room: Room): Player[] {
  return Object.values(room.players).filter((player) => isActiveRoundParticipant(room, player));
}

function canStartGame(room: Room): boolean {
  const players = Object.values(room.players).filter((player) => player.connected);
  if (players.length < 2) return false;
  return players.every((player) => player.ready);
}

function hasAllReadyForRound(room: Room): boolean {
  const players = getActiveRoundParticipants(room);
  return players.length > 0 && players.every((player) => player.ready);
}

function startGameInRoom(room: Room, roomCode: string) {
  const playerCount = Object.values(room.players).length;
  const maxLevel = maxLevelByPlayers(playerCount);
  clearLevelCompleteTimer(roomCode);

  room.status = 'in-game';
  room.game = {
    phase: 'focus',
    currentLevel: 1,
    maxLevel,
    lives: initialLivesByPlayers(playerCount),
    stars: 1,
    pile: [],
    pileHistory: [],
    lastPlayed: null,
    rewardMap: buildRewardMap(maxLevel),
    mode: gameModeForRoom(room),
    starProposal: null,
  };

  dealLevel(room);
  room.game.phase = 'focus';
  emitRoomUpdate(roomCode);
  io.to(roomCode).emit('game:started', {
    startedAt: Date.now(),
    message: 'Partida iniciada. Preparados…',
  });
  emitGameLog(roomCode, 'game:started', { byPlayerId: room.hostId, byPlayerName: getPlayerName(room, room.hostId) });

  // Primera ronda: transición automática a playing (sin pedir segundo listo).
  setTimeout(() => {
    const latestRoom = rooms.get(roomCode);
    if (!latestRoom || latestRoom !== room || !latestRoom.game) return;
    if (latestRoom.game.phase !== 'focus') return;

    latestRoom.game.phase = 'playing';
    Object.values(latestRoom.players).forEach((player) => {
      player.ready = false;
    });

    emitRoomUpdate(roomCode);
    scheduleCpuTurn(roomCode, ROUND_COUNTDOWN_DELAY_MS);
  }, 500);
}

function countRemainingCards(room: Room): number {
  return Object.values(room.players).reduce((sum, player) => sum + player.hand.length, 0);
}

function applyLevelReward(room: Room) {
  if (!room.game) return;

  const reward = room.game.rewardMap[room.game.currentLevel];
  if (!reward) return;

  if (reward === 'life') room.game.lives = Math.min(room.game.lives + 1, 5);
  if (reward === 'star') room.game.stars = Math.min(room.game.stars + 1, 3);
}

function getLevelReward(room: Room): RewardType | null {
  if (!room.game) return null;
  return room.game.rewardMap[room.game.currentLevel] ?? null;
}

function dealLevel(room: Room) {
  if (!room.game) return;

  const level = room.game.currentLevel;
  const deck = buildDeck();

  // Cada nivel arranca con pila limpia.
  room.game.pile = [];
  room.game.pileHistory = [];
  room.game.lastPlayed = null;

  Object.values(room.players).forEach((player) => {
    player.hand = deck.splice(0, level).sort((a, b) => a - b);
    player.ready = false;
  });

  room.game.phase = 'focus';
  room.game.starProposal = null;
  markCpuPlayersReady(room);
}

function completeLevelOrGame(room: Room, roomCode: string) {
  if (!room.game) return;

  const levelCompleted = room.game.currentLevel;
  const reward = getLevelReward(room);
  room.game.phase = 'level-complete';
  applyLevelReward(room);

  io.to(roomCode).emit('game:level-complete', {
    levelCompleted,
    reward,
    lives: room.game.lives,
    stars: room.game.stars,
  });
  emitGameLog(roomCode, 'game:level-complete', { levelCompleted });
  if (reward) {
    emitGameLog(roomCode, 'game:reward', {
      reward,
      lives: room.game.lives,
      stars: room.game.stars,
    });
  }

  if (room.game.currentLevel >= room.game.maxLevel) {
    room.game.phase = 'victory';
    emitGameLog(roomCode, 'game:victory', { levelCompleted, maxLevel: room.game.maxLevel });
    return;
  }

  setTimeout(() => {
    const latestRoom = rooms.get(roomCode);
    if (!latestRoom || latestRoom !== room || !latestRoom.game) return;
    if (latestRoom.game.phase !== 'level-complete') return;

    latestRoom.game.currentLevel += 1;
    dealLevel(latestRoom);
    emitRoomUpdate(roomCode);
    io.to(roomCode).emit('game:next-level-ready', { level: latestRoom.game.currentLevel });
    emitGameLog(roomCode, 'game:next-level-ready', { level: latestRoom.game.currentLevel });
  }, 2200);
}

function scheduleLevelCompletionAfterRoundOut(room: Room, roomCode: string) {
  if (!room.game || levelCompleteTimers.has(roomCode)) return;

  const flipTimer = setTimeout(() => {
    levelCompleteTimers.delete(roomCode);

    const latestRoom = rooms.get(roomCode);
    if (!latestRoom?.game || latestRoom !== room || countRemainingCards(latestRoom) !== 0) return;
    if (latestRoom.game.phase !== 'playing' && latestRoom.game.phase !== 'paused') return;

    latestRoom.game.phase = 'round-complete';
    emitRoomUpdate(roomCode);

    const unflipTimer = setTimeout(() => {
      levelCompleteTimers.delete(roomCode);

      const finalRoom = rooms.get(roomCode);
      if (!finalRoom?.game || finalRoom !== room || countRemainingCards(finalRoom) !== 0) return;
      if (finalRoom.game.phase !== 'round-complete') return;

      completeLevelOrGame(finalRoom, roomCode);
      emitRoomUpdate(roomCode);
    }, ROUND_OUT_UNFLIP_MS);

    levelCompleteTimers.set(roomCode, unflipTimer);
  }, ROUND_OUT_FLIP_MS);

  levelCompleteTimers.set(roomCode, flipTimer);
}

function resolveErrorAndDiscard(room: Room, playedCard: number) {
  if (!room.game) return;

  room.game.lives = Math.max(0, room.game.lives - 1);
  Object.values(room.players).forEach((player) => {
    player.hand = player.hand.filter((card) => card >= playedCard);
  });
}

function playCardInRoom(room: Room, roomCode: string, player: Player, card: number): { ok: boolean; error?: string } {
  if (!room.game) {
    return { ok: false, error: 'Juego inválido' };
  }

  if (room.game.phase !== 'playing') {
    return { ok: false, error: 'La ronda no está activa' };
  }

  if (!Number.isInteger(card)) {
    return { ok: false, error: 'Carta inválida' };
  }

  if (!player.hand.includes(card)) {
    return { ok: false, error: 'No tienes esa carta' };
  }

  const minCard = Math.min(...player.hand);
  if (card !== minCard) {
    return { ok: false, error: 'Debes jugar tu carta más baja primero' };
  }

  player.hand = player.hand.filter((value) => value !== card);

  const blockingCards = Object.values(room.players)
    .flatMap((handOwner) =>
      handOwner.hand
        .filter((handCard) => handCard < card)
        .map((value) => ({ value, playerId: handOwner.id, playerName: handOwner.name })),
    )
    .sort((a, b) => a.value - b.value);

  const hasLowerCardInAnyHand = blockingCards.length > 0;
  if (hasLowerCardInAnyHand) clearCpuTurn(roomCode);

  room.game.pile.push(card);
  room.game.pileHistory.push({ value: card, playerId: player.id });
  room.game.lastPlayed = card;
  room.game.starProposal = null;
  emitGameLog(roomCode, 'game:card-played', {
    playerId: player.id,
    playerName: player.name,
    card,
  });

  if (hasLowerCardInAnyHand) {
    resolveErrorAndDiscard(room, card);
    io.to(roomCode).emit('game:error-penalty', {
      playedCard: { value: card, playerId: player.id, playerName: player.name },
      blockingCards,
      lifeLost: 1,
    });
    emitGameLog(roomCode, 'game:error', {
      playedCard: { value: card, playerId: player.id, playerName: player.name },
      blockingCards,
    });
    blockingCards.forEach((discard) => {
      emitGameLog(roomCode, 'game:discard', {
        card: discard.value,
        playerId: discard.playerId,
        playerName: discard.playerName,
      });
    });
  }

  if (room.game.lives <= 0) {
    room.game.phase = 'game-over';
    clearCpuTurn(roomCode);
    emitRoomUpdate(roomCode);
    io.to(roomCode).emit('game:over', { reason: 'Sin vidas' });
    emitGameLog(roomCode, 'game:over', { reason: 'Sin vidas' });
    return { ok: true };
  }

  if (countRemainingCards(room) === 0) {
    clearCpuTurn(roomCode);
    scheduleLevelCompletionAfterRoundOut(room, roomCode);
    emitRoomUpdate(roomCode);
    return { ok: true };
  }

  emitRoomUpdate(roomCode);
  scheduleCpuTurn(roomCode, hasLowerCardInAnyHand ? ERROR_OVERLAY_DELAY_MS : 0);
  return { ok: true };
}

function scheduleCpuTurn(roomCode: string, extraDelayMs = 0) {
  if (cpuPlayTimers.has(roomCode)) return;

  const room = rooms.get(roomCode);
  if (!room?.game || room.game.mode !== 'dev-cpu' || room.game.phase !== 'playing' || room.game.starProposal) return;

  const lowest = findGlobalLowestCard(room);
  if (!lowest?.player.isCpu) return;

  const timer = setTimeout(() => {
    cpuPlayTimers.delete(roomCode);

    const latestRoom = rooms.get(roomCode);
    if (
      !latestRoom?.game ||
      latestRoom.game.mode !== 'dev-cpu' ||
      latestRoom.game.phase !== 'playing' ||
      latestRoom.game.starProposal
    ) {
      return;
    }

    const latestLowest = findGlobalLowestCard(latestRoom);
    if (!latestLowest?.player.isCpu) return;

    playCardInRoom(latestRoom, roomCode, latestLowest.player, latestLowest.card);
  }, Math.max(0, extraDelayMs) + DEV_CPU_PLAY_DELAY_MS);

  cpuPlayTimers.set(roomCode, timer);
}

function acceptCpuStarVotes(room: Room, roomCode: string) {
  if (!room.game?.starProposal) return;

  const starProposal = room.game.starProposal;
  Object.values(room.players).forEach((player) => {
    if (!player.isCpu || !isActiveRoundParticipant(room, player) || starProposal.acceptedBy.has(player.id)) return;

    starProposal.acceptedBy.add(player.id);
    emitGameLog(roomCode, 'game:star-accepted', {
      byPlayerId: player.id,
      byPlayerName: player.name,
    });
  });
}

function resolveStarIfEveryoneAccepted(room: Room, roomCode: string): boolean {
  if (!room.game?.starProposal) return false;

  const connectedPlayers = getActiveRoundParticipants(room).map((player) => player.id);

  const everyoneAccepted = connectedPlayers.every((id) => room.game?.starProposal?.acceptedBy.has(id));
  if (!everyoneAccepted) return false;

  const initiatorId = room.game.starProposal.initiatorId;
  const revealedPreview = Object.values(room.players)
    .filter((player) => player.hand.length > 0)
    .map((player) => ({ card: Math.min(...player.hand), playerId: player.id, playerName: player.name }))
    .sort((a, b) => a.card - b.card);

  clearCpuTurn(roomCode);
  resolveStar(room, roomCode);
  io.to(roomCode).emit('game:star-used', {
    message: 'Estrella usada. Se jugaron automáticamente las cartas más bajas.',
  });
  emitGameLog(roomCode, 'game:star-used', {
    byPlayerId: initiatorId,
    revealed: revealedPreview,
  });
  scheduleCpuTurn(roomCode, STAR_RESOLVED_CPU_DELAY_MS);
  return true;
}

function resolveStar(room: Room, roomCode: string) {
  if (!room.game || room.game.stars <= 0) return;

  const revealed: Array<{ card: number; playerId: string }> = [];
  Object.values(room.players).forEach((player) => {
    if (player.hand.length === 0) return;
    const lowest = Math.min(...player.hand);
    player.hand = player.hand.filter((card) => card !== lowest);
    revealed.push({ card: lowest, playerId: player.id });
  });

  revealed.sort((a, b) => a.card - b.card).forEach((entry) => {
    room.game?.pile.push(entry.card);
    room.game?.pileHistory.push({ value: entry.card, playerId: entry.playerId });
    if (room.game) room.game.lastPlayed = entry.card;
  });

  room.game.stars -= 1;
  room.game.starProposal = null;

  if (countRemainingCards(room) === 0) {
    scheduleLevelCompletionAfterRoundOut(room, roomCode);
  }
}

function pickNextHost(room: Room, roomCode?: string) {
  const previousHostId = room.hostId;
  const nextConnected = Object.values(room.players).find((player) => player.connected);
  if (nextConnected) {
    room.hostId = nextConnected.id;
  } else {
    const anyPlayer = Object.values(room.players)[0];
    if (anyPlayer) room.hostId = anyPlayer.id;
  }

  if (roomCode && room.hostId !== previousHostId) {
    emitGameLog(roomCode, 'room:host-changed', {
      fromPlayerId: previousHostId,
      toPlayerId: room.hostId,
      toPlayerName: getPlayerName(room, room.hostId),
    });
  }
}

function removePlayerCompletely(playerId: string) {
  const roomCode = playerRoom.get(playerId);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) {
    playerRoom.delete(playerId);
    return;
  }

  const player = room.players[playerId];
  if (!player) {
    playerRoom.delete(playerId);
    return;
  }

  if (player.socketId) {
    const activeSocket = io.sockets.sockets.get(player.socketId);
    if (activeSocket) void activeSocket.leave(roomCode);
    socketPlayer.delete(player.socketId);
  }

  if (room.game?.starProposal) {
    room.game.starProposal.acceptedBy.delete(playerId);
    if (room.game.starProposal.initiatorId === playerId) {
      room.game.starProposal = null;
    }
  }

  delete room.players[playerId];
  playerRoom.delete(playerId);
  resetDevCpuRoomToLobby(room, roomCode);

  if (room.hostId === playerId) pickNextHost(room, roomCode);

  if (Object.keys(room.players).length === 0) {
    clearCpuTurn(roomCode);
    clearLevelCompleteTimer(roomCode);
    rooms.delete(roomCode);
    return;
  }

  emitRoomUpdate(roomCode);
}

function markSocketDisconnected(socketId: string) {
  const playerId = socketPlayer.get(socketId);
  if (!playerId) return;

  socketPlayer.delete(socketId);

  const roomCode = playerRoom.get(playerId);
  if (!roomCode) return;

  const room = rooms.get(roomCode);
  if (!room) {
    playerRoom.delete(playerId);
    return;
  }

  const player = room.players[playerId];
  if (!player) {
    playerRoom.delete(playerId);
    return;
  }

  if (player.socketId === socketId) player.socketId = null;
  player.connected = false;
  player.ready = false;

  if (room.hostId === playerId) pickNextHost(room, roomCode);
  emitRoomUpdate(roomCode);
}

function getSocketContext(socketId: string): { playerId: string; room: Room; roomCode: string; player: Player } | null {
  const playerId = socketPlayer.get(socketId);
  if (!playerId) return null;

  const roomCode = playerRoom.get(playerId);
  if (!roomCode) return null;

  const room = rooms.get(roomCode);
  if (!room) return null;

  const player = room.players[playerId];
  if (!player) return null;
  if (player.socketId !== socketId) return null;

  return { playerId, room, roomCode, player };
}

function bindSocketToPlayer(socketId: string, playerId: string, roomCode: string) {
  socketPlayer.set(socketId, playerId);
  playerRoom.set(playerId, roomCode);
}

function isValidPlayerId(playerId: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(playerId);
}

function parseCpuRoomCode(roomCode: string): number | null {
  const match = /^CPUON([1-7])$/.exec(roomCode);
  if (!match) return null;
  return clampNumber(Number(match[1]), 1, MAX_PLAYERS - 1);
}

function createCpuRoom(roomCode: string, cpuPlayers: number, displayCode = roomCode): Room {
  const players: Record<string, Player> = {};
  for (let index = 1; index <= cpuPlayers; index += 1) {
    const id = `${roomCode.toLowerCase()}-cpu-${String(index).padStart(2, '0')}`;
    players[id] = {
      id,
      name: `CPU ${index}`,
      socketId: null,
      connected: true,
      ready: true,
      hand: [],
      isCpu: true,
    };
  }

  const hostId = Object.keys(players)[0];
  const room: Room = {
    code: roomCode,
    displayCode,
    shareable: false,
    hostId,
    status: 'lobby',
    players,
    game: null,
    logs: [],
  };

  rooms.set(roomCode, room);
  app.log.info({ roomCode, cpuPlayers }, 'CPU room ready');
  return room;
}

function resetDevCpuRoomToLobby(room: Room, roomCode: string) {
  if (!isDevCpuRoom(room) || getHumanPlayers(room).length > 0) return;

  clearCpuTurn(roomCode);
  clearLevelCompleteTimer(roomCode);
  room.status = 'lobby';
  room.game = null;

  Object.values(room.players).forEach((player) => {
    player.hand = [];
    player.connected = true;
    player.ready = true;
  });

  const cpuHost = Object.values(room.players).find((player) => player.isCpu);
  if (cpuHost) room.hostId = cpuHost.id;
}

io.on('connection', (socket) => {
  socket.on('room:leave', (ack?: (response: unknown) => void) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'No estás en una sala' });
      return;
    }

    emitGameLog(ctx.roomCode, 'room:left', {
      playerId: ctx.playerId,
      playerName: ctx.player.name,
    });
    removePlayerCompletely(ctx.playerId);
    ack?.({ ok: true });
  });

  socket.on('room:create', (payload: { playerName: string; playerId: string }, ack?: (response: unknown) => void) => {
    const playerName = payload?.playerName?.trim();
    const playerId = payload?.playerId?.trim();

    if (!playerName || !playerId || !isValidPlayerId(playerId)) {
      ack?.({ ok: false, error: 'Nombre o identificador de jugador inválido' });
      return;
    }

    const alreadyBound = socketPlayer.get(socket.id);
    if (alreadyBound && alreadyBound !== playerId) {
      removePlayerCompletely(alreadyBound);
    }

    removePlayerCompletely(playerId);

    const roomCode = createUniqueRoomCode();
    const room: Room = {
      code: roomCode,
      hostId: playerId,
      status: 'lobby',
      players: {
        [playerId]: {
          id: playerId,
          name: playerName,
          socketId: socket.id,
          connected: true,
          ready: false,
          hand: [],
        },
      },
      game: null,
      logs: [],
    };

    rooms.set(roomCode, room);
    bindSocketToPlayer(socket.id, playerId, roomCode);
    void socket.join(roomCode);

    emitRoomUpdate(roomCode);
    emitGameLog(roomCode, 'room:joined', { playerId, playerName });
    ack?.({ ok: true, room: serializeRoom(room), yourId: playerId });
  });

  socket.on(
    'room:join',
    (
      payload: { roomCode: string; playerName: string; playerId: string },
      ack?: (response: unknown) => void,
    ) => {
      const requestedRoomCode = payload?.roomCode?.trim().toUpperCase();
      const playerName = payload?.playerName?.trim();
      const playerId = payload?.playerId?.trim();

      if (!requestedRoomCode || !playerName || !playerId || !isValidPlayerId(playerId)) {
        ack?.({ ok: false, error: 'Código, nombre o identificador inválido' });
        return;
      }

      let roomCode = requestedRoomCode;
      let room = rooms.get(roomCode);
      if (!room) {
        const cpuPlayers = parseCpuRoomCode(requestedRoomCode);
        if (!cpuPlayers) {
          ack?.({ ok: false, error: 'La sala no existe' });
          return;
        }

        roomCode = createUniqueRoomCode();
        room = createCpuRoom(roomCode, cpuPlayers, requestedRoomCode);
      } else if (room.shareable === false && !room.players[playerId]) {
        ack?.({ ok: false, error: 'Esta sala privada no se puede compartir' });
        return;
      }

      const alreadyBound = socketPlayer.get(socket.id);
      if (alreadyBound && alreadyBound !== playerId) {
        removePlayerCompletely(alreadyBound);
      }

      const previousRoomCode = playerRoom.get(playerId);
      if (previousRoomCode && previousRoomCode !== roomCode) {
        removePlayerCompletely(playerId);
      }

      const existingPlayer = room.players[playerId];
      if (existingPlayer) {
        if (existingPlayer.socketId && existingPlayer.socketId !== socket.id) {
          socketPlayer.delete(existingPlayer.socketId);
          const oldSocket = io.sockets.sockets.get(existingPlayer.socketId);
          oldSocket?.disconnect(true);
        }

        existingPlayer.name = playerName;
        existingPlayer.socketId = socket.id;
        existingPlayer.connected = true;
        if (isDevCpuRoom(room) && !existingPlayer.isCpu && room.hostId !== playerId) {
          room.hostId = playerId;
          emitGameLog(roomCode, 'room:host-changed', {
            toPlayerId: playerId,
            toPlayerName: playerName,
          });
        }

        bindSocketToPlayer(socket.id, playerId, roomCode);
        void socket.join(roomCode);

        emitRoomUpdate(roomCode);
        emitGameLog(roomCode, 'room:reconnected', { playerId, playerName });
        ack?.({ ok: true, room: serializeRoom(room), yourId: playerId, reconnected: true });
        return;
      }

      if (room.status !== 'lobby') {
        ack?.({ ok: false, error: 'La partida ya comenzó en esta sala' });
        return;
      }

      const currentPlayers = Object.values(room.players);
      if (currentPlayers.length >= MAX_PLAYERS) {
        ack?.({ ok: false, error: `Sala completa (máximo ${MAX_PLAYERS} jugadores)` });
        return;
      }

      room.players[playerId] = {
        id: playerId,
        name: playerName,
        socketId: socket.id,
        connected: true,
        ready: false,
        hand: [],
      };
      if (isDevCpuRoom(room) && room.hostId !== playerId) {
        room.hostId = playerId;
        emitGameLog(roomCode, 'room:host-changed', {
          toPlayerId: playerId,
          toPlayerName: playerName,
        });
      }

      bindSocketToPlayer(socket.id, playerId, roomCode);
      void socket.join(roomCode);

      emitRoomUpdate(roomCode);
      emitGameLog(roomCode, 'room:joined', { playerId, playerName });
      ack?.({ ok: true, room: serializeRoom(room), yourId: playerId, reconnected: false });
    },
  );

  socket.on('player:ready', (payload: { ready: boolean }, ack?: (response: unknown) => void) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'No estás en una sala' });
      return;
    }

    ctx.player.ready = Boolean(payload?.ready);
    markCpuPlayersReady(ctx.room);

    if (
      ctx.room.game &&
      (ctx.room.game.phase === 'focus' || ctx.room.game.phase === 'paused') &&
      hasAllReadyForRound(ctx.room)
    ) {
      ctx.room.game.phase = 'playing';
      Object.values(ctx.room.players).forEach((player) => {
        player.ready = false;
      });
      scheduleCpuTurn(ctx.roomCode, ROUND_COUNTDOWN_DELAY_MS);
    }

    // Auto-inicio en lobby cuando todos están listos.
    if (ctx.room.status === 'lobby' && !ctx.room.game && canStartGame(ctx.room)) {
      startGameInRoom(ctx.room, ctx.roomCode);
      ack?.({ ok: true, autoStarted: true });
      return;
    }

    emitRoomUpdate(ctx.roomCode);
    ack?.({ ok: true });
  });

  socket.on('game:start', (ack?: (response: unknown) => void) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'No estás en una sala' });
      return;
    }

    if (ctx.room.hostId !== ctx.playerId) {
      ack?.({ ok: false, error: 'Solo el host puede iniciar' });
      return;
    }

    if (!canStartGame(ctx.room)) {
      ack?.({ ok: false, error: 'Todos deben estar listos (mínimo 2 jugadores)' });
      return;
    }

    startGameInRoom(ctx.room, ctx.roomCode);
    ack?.({ ok: true });
  });

  socket.on('game:retry', (ack?: (response: unknown) => void) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'No estás en una sala' });
      return;
    }

    if (ctx.room.hostId !== ctx.playerId) {
      ack?.({ ok: false, error: 'Solo el host puede reintentar' });
      return;
    }

    if (!ctx.room.game) {
      ack?.({ ok: false, error: 'No hay partida activa' });
      return;
    }

    const playerCount = Object.values(ctx.room.players).length;
    const maxLevel = maxLevelByPlayers(playerCount);
    clearLevelCompleteTimer(ctx.roomCode);
    ctx.room.status = 'in-game';
    ctx.room.game = {
      phase: 'focus',
      currentLevel: 1,
      maxLevel,
      lives: initialLivesByPlayers(playerCount),
      stars: 1,
      pile: [],
      pileHistory: [],
      lastPlayed: null,
      rewardMap: buildRewardMap(maxLevel),
      mode: gameModeForRoom(ctx.room),
      starProposal: null,
    };

    dealLevel(ctx.room);
    emitRoomUpdate(ctx.roomCode);
    io.to(ctx.roomCode).emit('game:restarted', {
      message: 'Partida reiniciada en la misma sala.',
    });
    emitGameLog(ctx.roomCode, 'game:restarted', { byPlayerId: ctx.playerId, byPlayerName: ctx.player.name });
    ack?.({ ok: true });
  });

  socket.on('game:play-card', (payload: { card: number }, ack?: (response: unknown) => void) => {
    const ctx = getSocketContext(socket.id);
    if (ctx) {
      const card = Number(payload?.card);
      ack?.(playCardInRoom(ctx.room, ctx.roomCode, ctx.player, card));
      return;
    }
    if (!ctx) {
      ack?.({ ok: false, error: 'No estás en una sala' });
      return;
    }
  });

  socket.on('game:pause-request', (ack?: (response: unknown) => void) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game) {
      ack?.({ ok: false, error: 'Juego inválido' });
      return;
    }

    if (ctx.room.game.phase !== 'playing') {
      ack?.({ ok: false, error: 'Solo puedes pausar durante juego activo' });
      return;
    }

    if (!isActiveRoundParticipant(ctx.room, ctx.player)) {
      ack?.({ ok: false, error: 'Ya terminaste tus cartas en esta ronda' });
      return;
    }

    ctx.room.game.phase = 'paused';
    Object.values(ctx.room.players).forEach((player) => {
      player.ready = false;
    });
    markCpuPlayersReady(ctx.room);
    clearCpuTurn(ctx.roomCode);

    emitRoomUpdate(ctx.roomCode);
    io.to(ctx.roomCode).emit('game:paused', {
      by: ctx.playerId,
      message: 'Pausa solicitada. Todos deben volver a listo para continuar.',
    });
    emitGameLog(ctx.roomCode, 'game:paused', { byPlayerId: ctx.playerId, byPlayerName: ctx.player.name });
    ack?.({ ok: true });
  });

  socket.on('star:propose', (ack?: (response: unknown) => void) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game) {
      ack?.({ ok: false, error: 'Juego inválido' });
      return;
    }

    if (ctx.room.game.phase !== 'playing') {
      ack?.({ ok: false, error: 'Solo puedes proponer estrella durante juego activo' });
      return;
    }

    if (ctx.room.game.stars <= 0) {
      ack?.({ ok: false, error: 'No quedan estrellas' });
      return;
    }

    if (!isActiveRoundParticipant(ctx.room, ctx.player)) {
      ack?.({ ok: false, error: 'Ya terminaste tus cartas en esta ronda' });
      return;
    }

    if (!ctx.room.game.starProposal) {
      ctx.room.game.starProposal = {
        initiatorId: ctx.playerId,
        acceptedBy: new Set([ctx.playerId]),
      };
      emitGameLog(ctx.roomCode, 'game:star-proposed', {
        byPlayerId: ctx.playerId,
        byPlayerName: ctx.player.name,
      });
    }

    acceptCpuStarVotes(ctx.room, ctx.roomCode);
    resolveStarIfEveryoneAccepted(ctx.room, ctx.roomCode);
    emitRoomUpdate(ctx.roomCode);
    ack?.({ ok: true });
  });

  socket.on('star:accept', (ack?: (response: unknown) => void) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game || !ctx.room.game.starProposal) {
      ack?.({ ok: false, error: 'No hay propuesta activa de estrella' });
      return;
    }

    if (ctx.room.game.phase !== 'playing') {
      ack?.({ ok: false, error: 'Solo puedes aceptar estrella durante juego activo' });
      return;
    }

    if (!isActiveRoundParticipant(ctx.room, ctx.player)) {
      ack?.({ ok: true });
      return;
    }

    if (ctx.room.game.starProposal.acceptedBy.has(ctx.playerId)) {
      ack?.({ ok: true });
      return;
    }

    ctx.room.game.starProposal.acceptedBy.add(ctx.playerId);
    emitGameLog(ctx.roomCode, 'game:star-accepted', {
      byPlayerId: ctx.playerId,
      byPlayerName: ctx.player.name,
    });

    acceptCpuStarVotes(ctx.room, ctx.roomCode);
    if (resolveStarIfEveryoneAccepted(ctx.room, ctx.roomCode)) {
      emitRoomUpdate(ctx.roomCode);
      ack?.({ ok: true });
      return;
    }

    const connectedPlayers = getActiveRoundParticipants(ctx.room).map((player) => player.id);

    const everyoneAccepted = connectedPlayers.every((id) => ctx.room.game?.starProposal?.acceptedBy.has(id));
    if (everyoneAccepted) {
      const initiatorId = ctx.room.game.starProposal?.initiatorId ?? null;
      const revealedPreview = Object.values(ctx.room.players)
        .filter((player) => player.hand.length > 0)
        .map((player) => ({ card: Math.min(...player.hand), playerId: player.id, playerName: player.name }))
        .sort((a, b) => a.card - b.card);

      resolveStar(ctx.room, ctx.roomCode);
      io.to(ctx.roomCode).emit('game:star-used', {
        message: 'Estrella usada. Se jugaron automáticamente las cartas más bajas.',
      });
      emitGameLog(ctx.roomCode, 'game:star-used', {
        byPlayerId: initiatorId,
        revealed: revealedPreview,
      });
    }

    emitRoomUpdate(ctx.roomCode);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    const playerId = socketPlayer.get(socket.id);
    if (playerId) {
      const roomCode = playerRoom.get(playerId);
      const room = roomCode ? rooms.get(roomCode) : null;
      if (roomCode && room && room.players[playerId]) {
        emitGameLog(roomCode, 'room:left', {
          playerId,
          playerName: room.players[playerId].name,
          reason: 'disconnect',
        });
      }
    }
    markSocketDisconnected(socket.id);
  });
});

await app.listen({ port: PORT, host: '0.0.0.0' });
