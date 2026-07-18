import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  GameLogEvent,
  GameLogType,
  PrivatePlayerEnvelope,
  PrivatePlayerState,
  PublicRoomEnvelope,
  PublicRoomState,
  RoomSnapshot,
  ServerToClientEvents,
} from '@the-hive/contracts';
import {
  parseIdentityPayload,
  parseJoinRoomPayload,
  parseKickPayload,
  parsePlayCardPayload,
  parseReadyPayload,
} from '@the-hive/contracts';
import { pathToFileURL } from 'node:url';
import { calculateFinalResults, type FinalPlayerResult } from './finalScoring.js';
import { buildPrivateActions } from './privateState.js';
import {
  applyRoundReadyRequest,
  createPauseEventPayload,
  getActiveRoundParticipants,
  getConnectedConsensusParticipants,
  hasAllReadyForRound,
  isActiveRoundParticipant,
  isRoundReadyParticipant,
  pauseRoundForReady as pauseRoundForReadyState,
} from './roundParticipants.js';
import {
  acknowledgePendingStarResolution,
  createPendingStarResolution,
  isPendingStarResolutionComplete,
  type PendingStarResolution,
} from './starResolution.js';
import { getRoundResolutionOutcome, shouldPauseAfterStarResolution, shouldResolveAfterErrorOverlay } from './roundResolution.js';
import {
  ERROR_LOCK_MS,
  LEVEL_COMPLETE_LOCK_MS,
  STAR_RESOLUTION_LOCK_MS,
  applyStarDiscardPreview,
  createInteractionLock,
  discardLowerCards,
  getDealLockDuration,
  isInteractionLockActive,
  type InteractionLock,
  type StarDiscardPreview,
  previewLowestCardPerPlayer,
} from './gameTiming.js';
import { nextLevelAdvanceDelayMs, nextLevelReadyLockMs } from './levelFlow.js';
import { resolveRoomJoin, validateLobbyKickRequest, validateLobbyStartRequest } from './lobbyRules.js';

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
  ts: number;
  source: 'manual' | 'star';
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
  interactionLock: InteractionLock | null;
  startedAt: number;
  errorCounts: Record<string, number>;
  finalResults: FinalPlayerResult[] | null;
};

type Room = {
  code: string;
  displayCode?: string;
  shareable?: boolean;
  hostId: string;
  players: Record<string, Player>;
  status: 'lobby' | 'in-game';
  game: GameState | null;
  version: number;
  logs: GameLogEvent[];
};

const rooms = new Map<string, Room>();
const playerRoom = new Map<string, string>();
const socketPlayer = new Map<string, string>();
const cpuPlayTimers = new Map<string, ReturnType<typeof setTimeout>>();
const levelCompleteTimers = new Map<string, ReturnType<typeof setTimeout>>();
const interactionLockTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingStarResolutions = new Map<string, PendingStarResolution>();
const starResolutionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const nextLevelTimers = new Map<string, ReturnType<typeof setTimeout>>();
let logSeq = 0;
let random = Math.random;
let timingScale = 1;
let listening = false;

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
const ROUND_COUNTDOWN_DELAY_MS = 3000;
const ROUND_OUT_FLIP_MS = 520;
const ROUND_OUT_UNFLIP_MS = 520;
const RESTART_BANNER_DELAY_MS = 5000;

let app: ReturnType<typeof Fastify>;
let io: Server<ClientToServerEvents, ServerToClientEvents>;

async function createTransport(): Promise<void> {
  app = Fastify({ logger: true });
  await app.register(cors, {
    origin: ALLOW_ALL_ORIGINS ? true : CLIENT_ORIGIN,
    credentials: !ALLOW_ALL_ORIGINS,
  });
  app.get('/health', async () => ({ ok: true }));
  io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: {
      origin: ALLOW_ALL_ORIGINS ? true : CLIENT_ORIGIN,
      methods: ['GET', 'POST'],
      credentials: !ALLOW_ALL_ORIGINS,
    },
  });
  registerSocketHandlers();
}

function generateRoomCode(length = 6): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(random() * chars.length)];
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

function serializeRoom(room: Room): PublicRoomState {
  if (room.game && !isInteractionLockActive(room.game.interactionLock)) {
    room.game.interactionLock = null;
  }

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
        interactionLock: room.game.interactionLock,
        finalResults: room.game.finalResults,
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

function buildPrivateState(room: Room, player: Player): PrivatePlayerState {
  const lockReason = room.game?.interactionLock?.reason ?? null;
  const interactionLocked = hasActiveInteractionLock(room);

  return {
    hand: [...player.hand].sort((a, b) => a - b),
    availableActions: buildPrivateActions({
      roomStatus: room.status,
      phase: room.game?.phase ?? null,
      isHost: room.hostId === player.id,
      ready: player.ready,
      handCount: player.hand.length,
      connectedPlayerCount: Object.values(room.players).filter((entry) => entry.connected).length,
      canStartGame: canStartGame(room),
      interactionLocked,
      interactionLockReason: lockReason,
      stars: room.game?.stars ?? 0,
      hasStarProposal: Boolean(room.game?.starProposal),
      alreadyAcceptedStar: Boolean(room.game?.starProposal?.acceptedBy.has(player.id)),
      isRoundReadyParticipant: isRoundReadyParticipant(room, player),
      isActiveRoundParticipant: isActiveRoundParticipant(room, player),
      canParticipateInStarConsensus: player.connected,
      inRoundReadyWindow: Boolean(room.game && (room.game.phase === 'focus' || room.game.phase === 'paused')),
      canRetry: Boolean(room.game && (room.game.phase === 'victory' || room.game.phase === 'game-over') && room.hostId === player.id),
    }),
  };
}

function createPublicRoomEnvelope(room: Room, serverTime = Date.now()): PublicRoomEnvelope {
  return {
    version: room.version,
    serverTime,
    publicState: serializeRoom(room),
  };
}

function createPrivateStateEnvelope(room: Room, player: Player, serverTime = Date.now()): PrivatePlayerEnvelope {
  return {
    version: room.version,
    serverTime,
    privateState: buildPrivateState(room, player),
  };
}

function createRoomSnapshot(room: Room, player: Player, serverTime = Date.now()): RoomSnapshot {
  return {
    version: room.version,
    serverTime,
    publicState: serializeRoom(room),
    privateState: buildPrivateState(room, player),
  };
}

function nextFunctionalVersion(room: Room): number {
  return room.version + 1;
}

function emitRoomUpdate(code: string) {
  const room = rooms.get(code);
  if (!room) return;

  room.version += 1;
  const serverTime = Date.now();

  io.to(code).emit('room:update', createPublicRoomEnvelope(room, serverTime));

  Object.values(room.players).forEach((player) => {
    if (!player.socketId) return;
    io.to(player.socketId).emit('player:state', createPrivateStateEnvelope(room, player, serverTime));
    io.to(player.socketId).emit('room:snapshot', createRoomSnapshot(room, player, serverTime));
  });
}

function emitGameLog(roomCode: string, type: GameLogType, payload: Record<string, unknown> = {}) {
  const room = rooms.get(roomCode);
  const entry: GameLogEvent = {
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
    const j = Math.floor(random() * (i + 1));
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

function clearNextLevelTimer(roomCode: string) {
  const timer = nextLevelTimers.get(roomCode);
  if (!timer) return;

  clearTimeout(timer);
  nextLevelTimers.delete(roomCode);
}

function scaledDuration(durationMs: number): number {
  return Math.max(0, durationMs * timingScale);
}

function clearInteractionLockTimer(roomCode: string) {
  const timer = interactionLockTimers.get(roomCode);
  if (!timer) return;

  clearTimeout(timer);
  interactionLockTimers.delete(roomCode);
}

function clearStarResolutionTimer(roomCode: string) {
  const timer = starResolutionTimers.get(roomCode);
  if (!timer) return;

  clearTimeout(timer);
  starResolutionTimers.delete(roomCode);
}

function clearPendingStarResolution(roomCode: string) {
  pendingStarResolutions.delete(roomCode);
  clearStarResolutionTimer(roomCode);
}

function hasActiveInteractionLock(room: Room): boolean {
  if (!room.game) return false;
  if (isInteractionLockActive(room.game.interactionLock)) return true;
  room.game.interactionLock = null;
  return false;
}

function setInteractionLock(
  room: Room,
  roomCode: string,
  reason: InteractionLock['reason'],
  durationMs: number,
  onRelease?: (latestRoom: Room) => void,
) {
  if (!room.game) return;

  clearInteractionLockTimer(roomCode);
  const scaledDurationMs = scaledDuration(durationMs);
  const lock = createInteractionLock(reason, scaledDurationMs);
  room.game.interactionLock = lock;

  const timer = setTimeout(() => {
    interactionLockTimers.delete(roomCode);

    const latestRoom = rooms.get(roomCode);
    if (!latestRoom?.game || latestRoom !== room) return;

    const activeLock = latestRoom.game.interactionLock;
    if (activeLock && (activeLock.reason !== lock.reason || activeLock.until !== lock.until)) return;

    latestRoom.game.interactionLock = null;
    onRelease?.(latestRoom);
    emitRoomUpdate(roomCode);
  }, scaledDurationMs);

  interactionLockTimers.set(roomCode, timer);
}

function beginRoundCountdown(room: Room, roomCode: string) {
  if (!room.game || hasActiveInteractionLock(room)) return;

  clearCpuTurn(roomCode);
  setInteractionLock(room, roomCode, 'countdown', ROUND_COUNTDOWN_DELAY_MS, (latestRoom) => {
    if (!latestRoom.game) return;
    if (latestRoom.game.phase !== 'focus' && latestRoom.game.phase !== 'paused') return;

    latestRoom.game.phase = 'playing';
    Object.values(latestRoom.players).forEach((player) => {
      player.ready = false;
    });

    scheduleCpuTurn(roomCode, 0);
  });
}

function findGlobalLowestCard(room: Room): { player: Player; card: number } | null {
  return Object.values(room.players).reduce<{ player: Player; card: number } | null>((lowest, player) => {
    if (player.hand.length === 0) return lowest;

    const card = Math.min(...player.hand);
    if (!lowest || card < lowest.card) return { player, card };
    return lowest;
  }, null);
}

function countConnectedPlayers(room: Room): number {
  return Object.values(room.players).filter((player) => player.connected).length;
}

function canStartGame(room: Room): boolean {
  return room.status === 'lobby' && !room.game && countConnectedPlayers(room) >= 2;
}

function startGameInRoom(room: Room, roomCode: string) {
  const playerCount = Object.values(room.players).length;
  const maxLevel = maxLevelByPlayers(playerCount);
  const startedAt = Date.now();
  clearLevelCompleteTimer(roomCode);
  clearInteractionLockTimer(roomCode);

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
    interactionLock: null,
    startedAt,
    errorCounts: {},
    finalResults: null,
  };

  dealLevel(room, false);
  setInteractionLock(room, roomCode, 'dealing', getDealLockDuration(room.game.currentLevel), (latestRoom) => {
    if (!latestRoom.game) return;
    if (latestRoom.game.phase !== 'focus') return;
    if (hasAllReadyForRound(latestRoom)) beginRoundCountdown(latestRoom, roomCode);
  });
  room.game.phase = 'focus';
  emitRoomUpdate(roomCode);
  io.to(roomCode).emit('game:started', {
    version: room.version,
    startedAt,
    message: 'Game started. Get ready...',
  });
  emitGameLog(roomCode, 'game:started', { byPlayerId: room.hostId, byPlayerName: getPlayerName(room, room.hostId) });
}

function countRemainingCards(room: Room): number {
  return Object.values(room.players).reduce((sum, player) => sum + player.hand.length, 0);
}

function pauseRoundForReady(room: Room, roomCode: string) {
  const didPause = pauseRoundForReadyState(room);
  if (!didPause) return false;

  markCpuPlayersReady(room);
  clearCpuTurn(roomCode);

  return didPause;
}

function finishGameOver(room: Room, roomCode: string, reason: string) {
  if (!room.game) return;

  finalizeGameResults(room);
  room.game.phase = 'game-over';
  clearCpuTurn(roomCode);
  emitRoomUpdate(roomCode);
  io.to(roomCode).emit('game:over', { version: room.version, reason });
  emitGameLog(roomCode, 'game:over', { reason });
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

function finalizeGameResults(room: Room) {
  if (!room.game) return;

  room.game.finalResults = calculateFinalResults({
    players: Object.values(room.players).map((player) => ({ id: player.id, name: player.name, isCpu: player.isCpu })),
    plays: room.game.pileHistory,
    gameStartedAt: room.game.startedAt,
    completedAt: Date.now(),
    errorCounts: room.game.errorCounts,
  });
}

function dealLevel(room: Room, resetReady = true) {
  if (!room.game) return;

  const level = room.game.currentLevel;
  const deck = buildDeck();

  // Cada nivel arranca con pila limpia.
  room.game.pile = [];
  room.game.pileHistory = [];
  room.game.lastPlayed = null;

  Object.values(room.players).forEach((player) => {
    player.hand = deck.splice(0, level).sort((a, b) => a - b);
    if (resetReady || player.isCpu) player.ready = Boolean(player.isCpu);
  });

  room.game.phase = 'focus';
  room.game.starProposal = null;
  room.game.finalResults = null;
}

function completeLevelOrGame(room: Room, roomCode: string) {
  if (!room.game) return;

  const levelCompleted = room.game.currentLevel;
  const reward = getLevelReward(room);
  room.game.phase = 'level-complete';
  applyLevelReward(room);

  io.to(roomCode).emit('game:level-complete', {
    version: nextFunctionalVersion(room),
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
    finalizeGameResults(room);
    room.game.phase = 'victory';
    emitGameLog(roomCode, 'game:victory', { levelCompleted, maxLevel: room.game.maxLevel });
    return;
  }

  const nextLevelDelayMs = nextLevelAdvanceDelayMs(room.game.interactionLock);

  clearNextLevelTimer(roomCode);
  const nextLevelTimer = setTimeout(() => {
    nextLevelTimers.delete(roomCode);
    const latestRoom = rooms.get(roomCode);
    if (!latestRoom || latestRoom !== room || !latestRoom.game) return;
    if (latestRoom.game.phase !== 'level-complete') return;

    latestRoom.game.currentLevel += 1;
    dealLevel(latestRoom);
    const nextLevelLockMs = nextLevelReadyLockMs(LEVEL_COMPLETE_LOCK_MS, getDealLockDuration(latestRoom.game.currentLevel));
    setInteractionLock(latestRoom, roomCode, 'level-complete', nextLevelLockMs, () => {
      if (!latestRoom.game) return;
      if (latestRoom.game.phase !== 'focus') return;
      if (hasAllReadyForRound(latestRoom)) beginRoundCountdown(latestRoom, roomCode);
    });
    emitRoomUpdate(roomCode);
    io.to(roomCode).emit('game:next-level-ready', { version: latestRoom.version, level: latestRoom.game.currentLevel });
    emitGameLog(roomCode, 'game:next-level-ready', { level: latestRoom.game.currentLevel });
  }, nextLevelDelayMs);
  nextLevelTimers.set(roomCode, nextLevelTimer);
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
    }, scaledDuration(ROUND_OUT_UNFLIP_MS));

    levelCompleteTimers.set(roomCode, unflipTimer);
  }, scaledDuration(ROUND_OUT_FLIP_MS));

  levelCompleteTimers.set(roomCode, flipTimer);
}

function resolveErrorAndDiscard(room: Room, playedCard: number) {
  if (!room.game) return;

  room.game.lives = Math.max(0, room.game.lives - 1);
  discardLowerCards(room.players, playedCard);
}

function playCardInRoom(room: Room, roomCode: string, player: Player, card: number): { ok: true } | { ok: false; error: string } {
  if (!room.game) {
    return { ok: false, error: 'Invalid game state' };
  }

  if (hasActiveInteractionLock(room)) {
    return { ok: false, error: 'Wait until the current transition finishes' };
  }

  if (room.game.phase !== 'playing') {
    return { ok: false, error: 'The round is not active' };
  }

  if (!Number.isInteger(card)) {
    return { ok: false, error: 'Invalid card' };
  }

  if (!player.hand.includes(card)) {
    return { ok: false, error: 'You do not have that card' };
  }

  const minCard = Math.min(...player.hand);
  if (card !== minCard) {
    return { ok: false, error: 'You must play your lowest card first' };
  }

  player.hand = player.hand.filter((value) => value !== card);
  const playedAt = Date.now();

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
  room.game.pileHistory.push({ value: card, playerId: player.id, ts: playedAt, source: 'manual' });
  room.game.lastPlayed = card;
  room.game.starProposal = null;
  emitGameLog(roomCode, 'game:card-played', {
    playerId: player.id,
    playerName: player.name,
    card,
  });

  if (hasLowerCardInAnyHand) {
    room.game.errorCounts[player.id] = (room.game.errorCounts[player.id] ?? 0) + 1;
    resolveErrorAndDiscard(room, card);

    setInteractionLock(room, roomCode, 'error', ERROR_LOCK_MS, (latestRoom) => {
      if (!latestRoom.game || latestRoom.game.phase !== 'playing') return;

      const latestOutcome = getRoundResolutionOutcome(latestRoom.game.lives, countRemainingCards(latestRoom));
      if (shouldResolveAfterErrorOverlay(latestOutcome)) {
        if (latestOutcome === 'game-over') {
          finishGameOver(latestRoom, roomCode, 'No lives left');
          return;
        }

        completeLevelOrGame(latestRoom, roomCode);
        return;
      }

      pauseRoundForReady(latestRoom, roomCode);
    });
    io.to(roomCode).emit('game:error-penalty', {
      version: nextFunctionalVersion(room),
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

    emitRoomUpdate(roomCode);
    return { ok: true };
  }

  const resolutionOutcome = getRoundResolutionOutcome(room.game.lives, countRemainingCards(room));

  if (resolutionOutcome === 'game-over') {
    finishGameOver(room, roomCode, 'No lives left');
    return { ok: true };
  }

  if (resolutionOutcome === 'level-complete') {
    clearCpuTurn(roomCode);
    scheduleLevelCompletionAfterRoundOut(room, roomCode);
    emitRoomUpdate(roomCode);
    return { ok: true };
  }

  emitRoomUpdate(roomCode);
  if (hasLowerCardInAnyHand) return { ok: true };

  scheduleCpuTurn(roomCode, 0);
  return { ok: true };
}

function scheduleCpuTurn(roomCode: string, extraDelayMs = 0) {
  if (cpuPlayTimers.has(roomCode)) return;

  const room = rooms.get(roomCode);
  if (!room?.game || room.game.mode !== 'dev-cpu' || room.game.phase !== 'playing' || room.game.starProposal || hasActiveInteractionLock(room)) return;

  const lowest = findGlobalLowestCard(room);
  if (!lowest?.player.isCpu) return;

  const timer = setTimeout(() => {
    cpuPlayTimers.delete(roomCode);

    const latestRoom = rooms.get(roomCode);
    if (
      !latestRoom?.game ||
      latestRoom.game.mode !== 'dev-cpu' ||
      latestRoom.game.phase !== 'playing' ||
      latestRoom.game.starProposal ||
      hasActiveInteractionLock(latestRoom)
    ) {
      return;
    }

    const latestLowest = findGlobalLowestCard(latestRoom);
    if (!latestLowest?.player.isCpu) return;

    playCardInRoom(latestRoom, roomCode, latestLowest.player, latestLowest.card);
  }, scaledDuration(Math.max(0, extraDelayMs) + DEV_CPU_PLAY_DELAY_MS));

  cpuPlayTimers.set(roomCode, timer);
}

function acceptCpuStarVotes(room: Room, roomCode: string) {
  if (!room.game?.starProposal) return;

  const starProposal = room.game.starProposal;
  Object.values(room.players).forEach((player) => {
    if (!player.isCpu || !player.connected || starProposal.acceptedBy.has(player.id)) return;

    starProposal.acceptedBy.add(player.id);
    emitGameLog(roomCode, 'game:star-accepted', {
      byPlayerId: player.id,
      byPlayerName: player.name,
    });
  });
}

function resolveStarIfEveryoneAccepted(room: Room, roomCode: string): boolean {
  if (!room.game?.starProposal) return false;

  const connectedPlayers = getConnectedConsensusParticipants(room).map((player) => player.id);

  const everyoneAccepted = connectedPlayers.every((id) => room.game?.starProposal?.acceptedBy.has(id));
  if (!everyoneAccepted) return false;

  const initiatorId = room.game.starProposal.initiatorId;
  clearCpuTurn(roomCode);
  const discarded = resolveStar(room, roomCode);
  const pendingResolution = createPendingStarResolution(discarded, room.players);
  pendingStarResolutions.set(roomCode, pendingResolution);
  clearStarResolutionTimer(roomCode);
  starResolutionTimers.set(
    roomCode,
    setTimeout(() => {
      starResolutionTimers.delete(roomCode);

      const latestRoom = rooms.get(roomCode);
      if (!latestRoom?.game) {
        pendingStarResolutions.delete(roomCode);
        return;
      }

      settlePendingStarResolution(latestRoom, roomCode);
    }, scaledDuration(STAR_RESOLUTION_LOCK_MS)),
  );
  setInteractionLock(room, roomCode, 'star', STAR_RESOLUTION_LOCK_MS, (latestRoom) => {
    if (!latestRoom.game || latestRoom.game.phase !== 'playing') return;

    if (pendingStarResolutions.has(roomCode)) settlePendingStarResolution(latestRoom, roomCode);
    if (!latestRoom.game || latestRoom.game.phase !== 'playing') return;

    if (shouldPauseAfterStarResolution(getRoundResolutionOutcome(latestRoom.game.lives, countRemainingCards(latestRoom)))) {
      pauseRoundForReady(latestRoom, roomCode);
    }
  });
  io.to(roomCode).emit('game:star-used', {
    version: nextFunctionalVersion(room),
    message: 'Star used. Lowest cards discarded.',
    discarded,
  });
  emitGameLog(roomCode, 'game:star-used', {
    byPlayerId: initiatorId,
    discarded,
  });
  if (isPendingStarResolutionComplete(pendingResolution)) settlePendingStarResolution(room, roomCode);
  return true;
}

function resolveStar(room: Room, roomCode: string): StarDiscardPreview[] {
  if (!room.game || room.game.stars <= 0) return [];

  const discarded = previewLowestCardPerPlayer(room.players);

  room.game.stars -= 1;
  room.game.starProposal = null;

  return discarded;
}

function finalizeStarResolution(room: Room, roomCode: string, discarded: StarDiscardPreview[]) {
  applyStarDiscardPreview(room.players, discarded);

  discarded.forEach((entry) => {
    emitGameLog(roomCode, 'game:discard', {
      card: entry.card,
      playerId: entry.playerId,
      playerName: entry.playerName,
      reason: 'star',
    });
  });
}

function settlePendingStarResolution(room: Room, roomCode: string) {
  const pending = pendingStarResolutions.get(roomCode);
  if (!pending || !room.game) return false;

  clearPendingStarResolution(roomCode);
  finalizeStarResolution(room, roomCode, pending.discarded);
  emitRoomUpdate(roomCode);

  if (countRemainingCards(room) === 0) {
    scheduleLevelCompletionAfterRoundOut(room, roomCode);
  }

  return true;
}

function acknowledgeStarDiscardAnimation(roomCode: string, playerId: string) {
  const room = rooms.get(roomCode);
  const pending = pendingStarResolutions.get(roomCode);
  if (!room || !pending) return false;

  const nextPending = acknowledgePendingStarResolution(pending, playerId);
  if (nextPending !== pending) pendingStarResolutions.set(roomCode, nextPending);
  if (!isPendingStarResolutionComplete(nextPending)) return true;

  settlePendingStarResolution(room, roomCode);
  return true;
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
    clearNextLevelTimer(roomCode);
    clearInteractionLockTimer(roomCode);
    clearPendingStarResolution(roomCode);
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

  acknowledgeStarDiscardAnimation(roomCode, playerId);

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
    version: 0,
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
    clearNextLevelTimer(roomCode);
  clearPendingStarResolution(roomCode);
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

function registerSocketHandlers() {
io.on('connection', (socket) => {
  socket.on('room:leave', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'You are not in a room' });
      return;
    }

    emitGameLog(ctx.roomCode, 'room:left', {
      playerId: ctx.playerId,
      playerName: ctx.player.name,
    });
    removePlayerCompletely(ctx.playerId);
    ack?.({ ok: true });
  });

  socket.on('room:resync', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'You are not in a room' });
      return;
    }

    ack?.({
      ok: true,
      snapshot: createRoomSnapshot(ctx.room, ctx.player),
      room: serializeRoom(ctx.room),
      hand: [...ctx.player.hand].sort((a, b) => a - b),
      syncedAt: Date.now(),
    });
  });

  socket.on('room:create', (payload, ack) => {
    const parsed = parseIdentityPayload(payload);
    if (!parsed.ok) {
      ack?.({ ok: false, error: 'Invalid player name or identifier' });
      return;
    }
    const playerName = parsed.value.playerName.trim();
    const playerId = parsed.value.playerId.trim();

    if (!playerName || !playerId || !isValidPlayerId(playerId)) {
        ack?.({ ok: false, error: 'Invalid player name or identifier' });
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
       version: 0,
       logs: [],
     };

    rooms.set(roomCode, room);
    bindSocketToPlayer(socket.id, playerId, roomCode);
    void socket.join(roomCode);

     emitRoomUpdate(roomCode);
     emitGameLog(roomCode, 'room:joined', { playerId, playerName });
     ack?.({ ok: true, snapshot: createRoomSnapshot(room, room.players[playerId]), room: serializeRoom(room), hand: [], yourId: playerId });
  });

  socket.on(
    'room:join',
    (
      payload,
      ack,
    ) => {
      const parsed = parseJoinRoomPayload(payload);
      if (!parsed.ok) {
        ack?.({ ok: false, error: 'Invalid room code, name, or identifier' });
        return;
      }
      const requestedRoomCode = parsed.value.roomCode.trim().toUpperCase();
      const playerName = parsed.value.playerName.trim();
      const playerId = parsed.value.playerId.trim();

      if (!requestedRoomCode || !playerName || !playerId || !isValidPlayerId(playerId)) {
        ack?.({ ok: false, error: 'Invalid room code, name, or identifier' });
        return;
      }

      let roomCode = requestedRoomCode;
      let room = rooms.get(roomCode);
      if (!room) {
        const cpuPlayers = parseCpuRoomCode(requestedRoomCode);
        if (!cpuPlayers) {
          ack?.({ ok: false, error: 'That room does not exist' });
          return;
        }

        roomCode = createUniqueRoomCode();
        room = createCpuRoom(roomCode, cpuPlayers, requestedRoomCode);
      } else if (room.shareable === false && !room.players[playerId]) {
        ack?.({ ok: false, error: 'This private room cannot be shared' });
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
      const joinDecision = resolveRoomJoin({
        roomStatus: room.status,
        existingPlayer: Boolean(existingPlayer),
      });
      if (!joinDecision.ok) {
        ack?.({ ok: false, error: joinDecision.error });
        return;
      }

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
        ack?.({
          ok: true,
          snapshot: createRoomSnapshot(room, existingPlayer),
          room: serializeRoom(room),
          hand: [...existingPlayer.hand].sort((a, b) => a - b),
          yourId: playerId,
          reconnected: true,
        });
        return;
      }

      const currentPlayers = Object.values(room.players);
      if (currentPlayers.length >= MAX_PLAYERS) {
        ack?.({ ok: false, error: `Room is full (maximum ${MAX_PLAYERS} players)` });
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
      ack?.({
        ok: true,
        snapshot: createRoomSnapshot(room, room.players[playerId]),
        room: serializeRoom(room),
        hand: [],
        yourId: playerId,
        reconnected: false,
      });
    },
  );

  socket.on('player:ready', (payload, ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'You are not in a room' });
      return;
    }

    if (ctx.room.game && hasActiveInteractionLock(ctx.room)) {
      const reason = ctx.room.game.interactionLock?.reason;
      const error =
        reason === 'dealing'
          ? 'Wait until dealing finishes'
          : reason === 'level-complete'
            ? 'Wait until the level clear message finishes'
          : reason === 'countdown'
            ? 'The countdown is already running'
            : reason === 'star'
              ? 'Wait until the star discard finishes'
            : 'Wait until the current transition finishes';
      ack?.({ ok: false, error });
      return;
    }

    const parsed = parseReadyPayload(payload);
    if (!parsed.ok) {
      ack?.({ ok: false, error: 'Invalid ready state' });
      return;
    }
    const readyDecision = applyRoundReadyRequest(
      ctx.room,
      ctx.player,
      parsed.value.ready,
      () => markCpuPlayersReady(ctx.room),
    );
    if (!readyDecision.ok) {
      ack?.(readyDecision);
      return;
    }

    if (readyDecision.shouldBeginCountdown) {
      beginRoundCountdown(ctx.room, ctx.roomCode);
    }

    emitRoomUpdate(ctx.roomCode);
    ack?.({ ok: true });
  });

  socket.on('room:kick', (payload, ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'You are not in a room' });
      return;
    }

    const parsed = parseKickPayload(payload);
    const targetPlayerId = parsed.ok ? parsed.value.targetPlayerId.trim() : undefined;
    const decision = validateLobbyKickRequest({
      isHost: ctx.room.hostId === ctx.playerId,
      roomStatus: ctx.room.status,
      actorId: ctx.playerId,
      targetId: targetPlayerId,
      targetExists: Boolean(targetPlayerId && ctx.room.players[targetPlayerId]),
    });
    if (!decision.ok) {
      ack?.({ ok: false, error: decision.error });
      return;
    }

    const targetPlayer = ctx.room.players[targetPlayerId!];
    if (targetPlayer.socketId) {
      io.to(targetPlayer.socketId).emit('room:kicked', {
        roomCode: ctx.roomCode,
        message: 'The host removed you from the room.',
      });
    }

    emitGameLog(ctx.roomCode, 'room:left', {
      playerId: targetPlayer.id,
      playerName: targetPlayer.name,
      removedByPlayerId: ctx.playerId,
      removedByPlayerName: ctx.player.name,
      reason: 'kicked',
    });
    removePlayerCompletely(targetPlayer.id);
    ack?.({ ok: true });
  });

  socket.on('game:start', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'You are not in a room' });
      return;
    }

    const decision = validateLobbyStartRequest({
      isHost: ctx.room.hostId === ctx.playerId,
      roomStatus: ctx.room.status,
      hasGame: Boolean(ctx.room.game),
      connectedPlayerCount: countConnectedPlayers(ctx.room),
    });
    if (!decision.ok) {
      ack?.({ ok: false, error: decision.error });
      return;
    }

    startGameInRoom(ctx.room, ctx.roomCode);
    ack?.({ ok: true });
  });

  socket.on('game:retry', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'You are not in a room' });
      return;
    }

    if (ctx.room.hostId !== ctx.playerId) {
      ack?.({ ok: false, error: 'Only the host can retry' });
      return;
    }

    if (!ctx.room.game) {
      ack?.({ ok: false, error: 'There is no active game' });
      return;
    }

    const playerCount = Object.values(ctx.room.players).length;
    const maxLevel = maxLevelByPlayers(playerCount);
    const startedAt = Date.now();
    clearLevelCompleteTimer(ctx.roomCode);
    clearInteractionLockTimer(ctx.roomCode);
    clearPendingStarResolution(ctx.roomCode);
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
      interactionLock: null,
      startedAt,
      errorCounts: {},
      finalResults: null,
    };

    dealLevel(ctx.room);
    setInteractionLock(ctx.room, ctx.roomCode, 'dealing', Math.max(RESTART_BANNER_DELAY_MS, getDealLockDuration(ctx.room.game.currentLevel)));
    emitRoomUpdate(ctx.roomCode);
    io.to(ctx.roomCode).emit('game:restarted', {
      version: ctx.room.version,
      message: 'Game restarted in the same room.',
    });
    emitGameLog(ctx.roomCode, 'game:restarted', { byPlayerId: ctx.playerId, byPlayerName: ctx.player.name });
    ack?.({ ok: true });
  });

  socket.on('game:play-card', (payload, ack) => {
    const ctx = getSocketContext(socket.id);
    if (ctx) {
      const parsed = parsePlayCardPayload(payload);
      if (!parsed.ok) {
        ack?.({ ok: false, error: 'Invalid card' });
        return;
      }
      ack?.(playCardInRoom(ctx.room, ctx.roomCode, ctx.player, parsed.value.card));
      return;
    }
    if (!ctx) {
      ack?.({ ok: false, error: 'You are not in a room' });
      return;
    }
  });

  socket.on('game:pause-request', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game) {
      ack?.({ ok: false, error: 'Invalid game state' });
      return;
    }

    if (ctx.room.game.phase !== 'playing') {
      ack?.({ ok: false, error: 'You can only pause during active play' });
      return;
    }

    if (hasActiveInteractionLock(ctx.room)) {
      ack?.({ ok: false, error: 'Wait until the current transition finishes' });
      return;
    }

    if (!isActiveRoundParticipant(ctx.room, ctx.player)) {
      ack?.({ ok: false, error: 'You already finished your cards this round' });
      return;
    }

    pauseRoundForReady(ctx.room, ctx.roomCode);

    emitRoomUpdate(ctx.roomCode);
    io.to(ctx.roomCode).emit('game:paused', createPauseEventPayload(ctx.room.version, ctx.playerId));
    emitGameLog(ctx.roomCode, 'game:paused', { byPlayerId: ctx.playerId, byPlayerName: ctx.player.name });
    ack?.({ ok: true });
  });

  socket.on('star:propose', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game) {
      ack?.({ ok: false, error: 'Invalid game state' });
      return;
    }

    if (ctx.room.game.phase !== 'playing') {
      ack?.({ ok: false, error: 'You can only propose a star during active play' });
      return;
    }

    if (hasActiveInteractionLock(ctx.room)) {
      ack?.({ ok: false, error: 'Wait until the current transition finishes' });
      return;
    }

    if (ctx.room.game.stars <= 0) {
      ack?.({ ok: false, error: 'No stars left' });
      return;
    }

    if (!isActiveRoundParticipant(ctx.room, ctx.player)) {
      ack?.({ ok: false, error: 'You already finished your cards this round' });
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

  socket.on('star:accept', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game || !ctx.room.game.starProposal) {
      ack?.({ ok: false, error: 'There is no active star proposal' });
      return;
    }

    if (ctx.room.game.phase !== 'playing') {
      ack?.({ ok: false, error: 'You can only accept a star during active play' });
      return;
    }

    if (hasActiveInteractionLock(ctx.room)) {
      ack?.({ ok: false, error: 'Wait until the current transition finishes' });
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

    emitRoomUpdate(ctx.roomCode);
    ack?.({ ok: true });
  });

  socket.on('star:cancel', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game || !ctx.room.game.starProposal) {
      ack?.({ ok: false, error: 'There is no active star proposal' });
      return;
    }

    if (ctx.room.game.phase !== 'playing') {
      ack?.({ ok: false, error: 'You can only cancel a star during active play' });
      return;
    }

    if (hasActiveInteractionLock(ctx.room)) {
      ack?.({ ok: false, error: 'Wait until the current transition finishes' });
      return;
    }

    if (!isActiveRoundParticipant(ctx.room, ctx.player)) {
      ack?.({ ok: false, error: 'You already finished your cards this round' });
      return;
    }

    if (ctx.room.game.starProposal.initiatorId !== ctx.playerId) {
      ack?.({ ok: false, error: 'Only the proposing player can cancel the star' });
      return;
    }

    ctx.room.game.starProposal = null;
    emitRoomUpdate(ctx.roomCode);
    scheduleCpuTurn(ctx.roomCode, 0);
    ack?.({ ok: true });
  });

  socket.on('star:reject', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game || !ctx.room.game.starProposal) {
      ack?.({ ok: false, error: 'There is no active star proposal' });
      return;
    }

    if (ctx.room.game.phase !== 'playing') {
      ack?.({ ok: false, error: 'You can only reject a star during active play' });
      return;
    }

    if (hasActiveInteractionLock(ctx.room)) {
      ack?.({ ok: false, error: 'Wait until the current transition finishes' });
      return;
    }

    if (ctx.room.game.starProposal.initiatorId === ctx.playerId) {
      ack?.({ ok: false, error: 'The proposing player must cancel the star directly' });
      return;
    }

    ctx.room.game.starProposal = null;
    emitRoomUpdate(ctx.roomCode);
    scheduleCpuTurn(ctx.roomCode, 0);
    ack?.({ ok: true });
  });

  socket.on('star:discard-animation-complete', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'You are not in a room' });
      return;
    }

    acknowledgeStarDiscardAnimation(ctx.roomCode, ctx.playerId);
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
}

export type ServerStartOptions = {
  port?: number;
  host?: string;
  random?: () => number;
  timingScale?: number;
};

export async function startServer(options: ServerStartOptions = {}): Promise<{ url: string; port: number }> {
  if (listening) {
    const address = app.server.address();
    if (address && typeof address !== 'string') return { url: `http://${options.host ?? '127.0.0.1'}:${address.port}`, port: address.port };
    throw new Error('Server is already starting');
  }

  if (!app) await createTransport();
  random = options.random ?? Math.random;
  timingScale = Number.isFinite(options.timingScale) ? Math.max(0, options.timingScale!) : 1;
  const host = options.host ?? '0.0.0.0';
  await app.listen({ port: options.port ?? PORT, host });
  listening = true;
  const address = app.server.address();
  const port = address && typeof address !== 'string' ? address.port : options.port ?? PORT;
  return { url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`, port };
}

export function resetServerForTests(): void {
  for (const roomCode of new Set([...cpuPlayTimers.keys(), ...levelCompleteTimers.keys(), ...interactionLockTimers.keys(), ...starResolutionTimers.keys(), ...nextLevelTimers.keys()])) {
    clearCpuTurn(roomCode);
    clearLevelCompleteTimer(roomCode);
    clearInteractionLockTimer(roomCode);
    clearPendingStarResolution(roomCode);
    clearNextLevelTimer(roomCode);
  }
  rooms.clear();
  playerRoom.clear();
  socketPlayer.clear();
  pendingStarResolutions.clear();
  logSeq = 0;
}

export async function stopServer(): Promise<void> {
  resetServerForTests();
  if (listening) await io.close();
  listening = false;
  app = undefined as unknown as ReturnType<typeof Fastify>;
  random = Math.random;
  timingScale = 1;
}

const isDirectEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectEntry) await startServer();
