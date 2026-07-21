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
  GamePhase,
  RoomStatus,
} from '@the-hive/contracts';
import {
  parseIdentityPayload,
  parseJoinRoomPayload,
  parseKickPayload,
  parsePlayCardPayload,
  parseReadyPayload,
} from '@the-hive/contracts';
import { pathToFileURL } from 'node:url';
import { buildPrivateActions } from './privateState.js';
import {
  playParticipants,
  readyParticipants,
} from './domain/participants.js';
import { applyDomainResult, toDomainMatch } from './domainAdapter.js';
import { expireCardEffect, playCard, type CardDurations } from './domain/cards.js';
import { advanceLevel, completeLevel, expireProgressionEffect, finishGame } from './domain/progression.js';
import type { DomainFinalPlayerResult as FinalPlayerResult, DomainRewardType as RewardType } from './domain/model.js';
import { retryGame, startGame } from './domain/setup.js';
import { expireRoundEffect, pauseRound, setRoundReady } from './domain/round.js';
import { acceptStar, cancelStar, proposeStar, rejectStar, settleStar, type StarInput } from './domain/star.js';
import type { DomainEffect, DomainEvent } from './domain/result.js';
import {
  acknowledgeStarAnimation,
  createPendingStarAnimation,
  disconnectStarAnimation,
  isStarAnimationComplete,
  type PendingStarAnimation,
} from './starAnimation.js';
import {
  ERROR_LOCK_MS,
  LEVEL_COMPLETE_LOCK_MS,
  getDealLockDuration,
  isInteractionLockActive,
  type InteractionLock,
} from './gameTiming.js';
import { resolveRoomJoin, validateLobbyKickRequest } from './lobbyRules.js';
import type { MachineState } from './gameStateMachine.js';

type Player = {
  id: string;
  name: string;
  socketId: string | null;
  connected: boolean;
  ready: boolean;
  hand: number[];
  isCpu?: boolean;
};

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
  phase: GamePhase;
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
  status: RoomStatus;
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
const pendingStarResolutions = new Map<string, PendingStarAnimation>();
const starResolutionTimers = new Map<string, ReturnType<typeof setTimeout>>();
const nextLevelTimers = new Map<string, ReturnType<typeof setTimeout>>();
let logSeq = 0;
let random = Math.random;
let timingScale = 1;
let listening = false;

const MAX_PLAYERS = 8;

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
      isStarProposalInitiator: room.game?.starProposal?.initiatorId === player.id,
      isRoundReadyParticipant: readyParticipants({ players: Object.values(room.players) }).includes(player),
      isActiveRoundParticipant: playParticipants({ players: Object.values(room.players) }).includes(player),
      canParticipateInStarConsensus: player.connected,
      inRoundReadyWindow: Boolean(room.game && (room.game.phase === 'focus' || room.game.phase === 'paused')),
      canRetry: Boolean(room.game && (room.game.phase === 'victory' || room.game.phase === 'game-over') && room.hostId === player.id),
      machineState: createMachineState(room, player),
      now: Date.now(),
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

function getHumanPlayers(room: Room): Player[] {
  return Object.values(room.players).filter((player) => !player.isCpu);
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

/** The shell is the only scheduler: effects already contain the domain deadline and stale expectations. */
function materializeDomainEffects(roomCode: string, effects: DomainEffect[]) {
  for (const effect of effects) {
    if (effect.trigger !== 'dealing-expired' && effect.trigger !== 'countdown-expired') continue;
    clearInteractionLockTimer(roomCode);
    const delay = Math.max(0, effect.dueAt - Date.now());
    const timer = setTimeout(() => {
      interactionLockTimers.delete(roomCode);
      const room = rooms.get(roomCode);
      const actor = room?.players[room.hostId];
      if (!room || !actor) return;
      const result = expireRoundEffect(
        toDomainMatch(room), actor.id, effect, Math.max(Date.now(), effect.dueAt), scaledDuration(ROUND_COUNTDOWN_DELAY_MS),
      );
      if (!result.ok) return;
      const applied = applyDomainResult(room, result);
      if (!applied.applied) return;
      materializeDomainEffects(roomCode, applied.effects);
      emitRoomUpdate(roomCode);
      if (room.game?.phase === 'playing') scheduleCpuTurn(roomCode, 0);
    }, delay);
    interactionLockTimers.set(roomCode, timer);
  }
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
  return isInteractionLockActive(room.game.interactionLock);
}

function createMachineState(room: Room, player: Player, card?: number): MachineState {
  const game = room.game;
  return {
    roomStatus: room.status,
    phase: game?.phase ?? null,
    lock: game?.interactionLock ?? null,
    lives: game?.lives ?? 0,
    stars: game?.stars ?? 0,
    hasStarProposal: Boolean(game?.starProposal),
    starInitiatorId: game?.starProposal?.initiatorId ?? null,
    acceptedStarBy: game?.starProposal ? [...game.starProposal.acceptedBy] : [],
    isHost: room.hostId === player.id,
    actorId: player.id,
    players: Object.values(room.players).map((entry) => ({
      id: entry.id,
      connected: entry.connected,
      ready: entry.ready,
      hand: [...entry.hand],
      isCpu: entry.isCpu,
    })),
    card,
  };
}

function startRoundCountdownIfReady(room: Room, roomCode: string): void {
  if (!room.game) return;
  const participant = readyParticipants({ players: Object.values(room.players) })[0];
  if (!participant) return;
  const result = setRoundReady(toDomainMatch(room), participant.id, participant.ready, {
    now: Date.now(),
    countdownMs: scaledDuration(ROUND_COUNTDOWN_DELAY_MS),
  });
  if (!result.ok || !result.effects.length) return;
  clearCpuTurn(roomCode);
  applyDomainResult(room, result);
  materializeDomainEffects(roomCode, result.effects);
}

/** The shell schedules progression effects but delegates stale checks and every game mutation to the domain. */
function materializeProgressionEffects(roomCode: string, effects: DomainEffect[]): void {
  for (const effect of effects) {
    if (effect.trigger !== 'next-level-expired' && effect.trigger !== 'level-ready-expired') continue;
    clearNextLevelTimer(roomCode);
    const timer = setTimeout(() => {
      nextLevelTimers.delete(roomCode);
      const room = rooms.get(roomCode);
      const actor = room?.players[room.hostId];
      if (!room || !actor || !room.game) return;
      const now = Math.max(Date.now(), effect.dueAt);
      if (effect.trigger === 'next-level-expired') {
        const result = advanceLevel(toDomainMatch(room), actor.id, effect, {
          now,
          deck: buildDeck(),
          levelCompleteMs: scaledDuration(LEVEL_COMPLETE_LOCK_MS),
          dealingMs: scaledDuration(getDealLockDuration(room.game.currentLevel + 1)),
        });
        if (!result.ok) return;
        const applied = applyDomainResult(room, result);
        if (!applied.applied) return;
        materializeProgressionEffects(roomCode, applied.effects);
        emitRoomUpdate(roomCode);
        translateProgressionEvents(room, roomCode, applied.events);
        return;
      }
      const result = expireProgressionEffect(toDomainMatch(room), actor.id, effect, now);
      if (!result.ok || !applyDomainResult(room, result).applied) return;
      startRoundCountdownIfReady(room, roomCode);
      emitRoomUpdate(roomCode);
    }, Math.max(0, effect.dueAt - Date.now()));
    nextLevelTimers.set(roomCode, timer);
  }
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

function finishGameOver(room: Room, roomCode: string, reason: string) {
  if (!room.game) return;
  const result = finishGame(toDomainMatch(room), room.hostId, 'game-over', Date.now());
  if (!result.ok || !applyDomainResult(room, result).applied) return;
  clearCpuTurn(roomCode);
  emitRoomUpdate(roomCode);
  io.to(roomCode).emit('game:over', { version: room.version, reason });
  emitGameLog(roomCode, 'game:over', { reason });
}

function translateProgressionEvents(room: Room, roomCode: string, events: DomainEvent[]): void {
  for (const event of events) {
    if (event.type === 'level-completed') {
      io.to(roomCode).emit('game:level-complete', {
        version: nextFunctionalVersion(room), levelCompleted: event.level, reward: event.reward,
        lives: room.game!.lives, stars: room.game!.stars,
      });
      emitGameLog(roomCode, 'game:level-complete', { levelCompleted: event.level });
    }
    if (event.type === 'reward-applied') {
      emitGameLog(roomCode, 'game:reward', { reward: event.reward, lives: room.game!.lives, stars: room.game!.stars });
    }
    if (event.type === 'next-level-ready') {
      io.to(roomCode).emit('game:next-level-ready', { version: room.version, level: event.level });
      emitGameLog(roomCode, 'game:next-level-ready', { level: event.level });
    }
    if (event.type === 'victory') emitGameLog(roomCode, 'game:victory', { levelCompleted: room.game!.currentLevel, maxLevel: room.game!.maxLevel });
  }
}

function completeLevelWithDomain(room: Room, roomCode: string, now = Date.now()): void {
  if (!room.game) return;
  const result = completeLevel(toDomainMatch(room), room.hostId, { now, completedAt: now });
  if (!result.ok || !applyDomainResult(room, result).applied) return;
  translateProgressionEvents(room, roomCode, result.events);
  materializeProgressionEffects(roomCode, result.effects);
}

function cardDurations(): CardDurations {
  return {
    errorOverlayMs: scaledDuration(ERROR_LOCK_MS),
    roundFlipMs: scaledDuration(ROUND_OUT_FLIP_MS),
    roundUnflipMs: scaledDuration(ROUND_OUT_UNFLIP_MS),
  };
}

function translatePauseRequest(room: Room, roomCode: string, events: DomainEvent[]): void {
  const requested = events.find((event) => event.type === 'round-pause-requested');
  if (!requested) return;
  const by = requested.playerId;
  const pausePayload = { version: room.version, by, message: 'Pause requested. The hive waits only for players still carrying cards.' };
  io.to(roomCode).emit('game:paused', pausePayload);
  emitGameLog(roomCode, 'game:paused', { byPlayerId: by, byPlayerName: getPlayerName(room, by) });
}

function translateCardEvents(room: Room, roomCode: string, events: DomainEvent[]): { terminal: boolean; continueRound: boolean } {
  let terminal = false;
  let continueRound = false;
  for (const event of events) {
    if (event.type === 'card-played') {
      emitGameLog(roomCode, 'game:card-played', { playerId: event.playerId, playerName: getPlayerName(room, event.playerId), card: event.card });
    }
    if (event.type === 'error-penalty') {
      const playedCard = { value: event.card, playerId: event.playerId, playerName: getPlayerName(room, event.playerId) };
      const blockingCards = event.blockingCards.map((discard) => ({ ...discard, playerName: getPlayerName(room, discard.playerId) }));
      io.to(roomCode).emit('game:error-penalty', { version: nextFunctionalVersion(room), playedCard, blockingCards, lifeLost: event.lifeLost });
      emitGameLog(roomCode, 'game:error', { playedCard, blockingCards });
    }
    if (event.type === 'card-discarded') {
      emitGameLog(roomCode, 'game:discard', { card: event.card, playerId: event.playerId, playerName: getPlayerName(room, event.playerId) });
    }
    if (event.type === 'card-outcome') {
      if (event.outcome === 'pause') continueRound = true;
      if (event.outcome === 'game-over') {
        finishGameOver(room, roomCode, 'No lives left');
        terminal = true;
      }
      if (event.outcome === 'level-complete') completeLevelWithDomain(room, roomCode);
    }
  }
  return { terminal, continueRound };
}

/** Materializes accepted card effects without deriving blockers, penalties, or outcomes in the shell. */
function materializeCardEffects(roomCode: string, effects: DomainEffect[]) {
  for (const effect of effects) {
    if (effect.trigger !== 'error-expired' && effect.trigger !== 'round-flip-expired' && effect.trigger !== 'round-unflip-expired') continue;
    const timers = effect.trigger === 'error-expired' ? interactionLockTimers : levelCompleteTimers;
    const clear = effect.trigger === 'error-expired' ? clearInteractionLockTimer : clearLevelCompleteTimer;
    clear(roomCode);
    const delay = Math.max(0, effect.dueAt - Date.now());
    const timer = setTimeout(() => {
      timers.delete(roomCode);
      const room = rooms.get(roomCode);
      const actor = room?.players[room.hostId];
      if (!room || !actor) return;
      const result = expireCardEffect(toDomainMatch(room), actor.id, effect, Math.max(Date.now(), effect.dueAt), cardDurations());
      if (!result.ok) return;
      const applied = applyDomainResult(room, result);
      if (!applied.applied) return;
      const translated = translateCardEvents(room, roomCode, applied.events);
      materializeCardEffects(roomCode, applied.effects);
      if (!translated.terminal) emitRoomUpdate(roomCode);
    }, delay);
    timers.set(roomCode, timer);
  }
}

function playCardWithDomain(room: Room, roomCode: string, player: Player, card: number): { ok: true } | { ok: false; error: string } {
  const result = playCard(toDomainMatch(room), player.id, card, Date.now(), cardDurations());
  if (!result.ok) return { ok: false, error: result.error };
  const applied = applyDomainResult(room, result);
  if (!applied.applied) return { ok: false, error: 'Invalid game state' };
  const hasError = applied.events.some((event) => event.type === 'error-penalty');
  const closesRound = applied.effects.some((effect) => effect.trigger === 'round-flip-expired');
  translateCardEvents(room, roomCode, applied.events);
  if (hasError || closesRound) clearCpuTurn(roomCode);
  materializeCardEffects(roomCode, applied.effects);
  emitRoomUpdate(roomCode);
  if (!hasError && !closesRound) scheduleCpuTurn(roomCode, 0);
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

    playCardWithDomain(latestRoom, roomCode, latestLowest.player, latestLowest.card);
  }, scaledDuration(Math.max(0, extraDelayMs) + DEV_CPU_PLAY_DELAY_MS));

  cpuPlayTimers.set(roomCode, timer);
}

function starInput(now = Date.now()): StarInput {
  return { now, resolutionMs: scaledDuration(5000), roundFlipMs: scaledDuration(ROUND_OUT_FLIP_MS) };
}

function translateStarEvents(room: Room, roomCode: string, events: DomainEvent[]): void {
  events.forEach((event) => {
    if (event.type === 'star-proposed') emitGameLog(roomCode, 'game:star-proposed', { byPlayerId: event.playerId, byPlayerName: getPlayerName(room, event.playerId) });
    if (event.type === 'star-accepted') emitGameLog(roomCode, 'game:star-accepted', { byPlayerId: event.playerId, byPlayerName: getPlayerName(room, event.playerId) });
    if (event.type === 'star-used') {
      io.to(roomCode).emit('game:star-used', { version: nextFunctionalVersion(room), message: 'Star used. Lowest cards discarded.', discarded: event.discarded });
      emitGameLog(roomCode, 'game:star-used', { byPlayerId: event.playerId, discarded: event.discarded });
    }
    if (event.type === 'card-discarded' && event.reason === 'star') {
      emitGameLog(roomCode, 'game:discard', { card: event.card, playerId: event.playerId, playerName: getPlayerName(room, event.playerId), reason: 'star' });
    }
    if (event.type === 'star-outcome' && event.outcome === 'game-over') finishGameOver(room, roomCode, 'No lives left');
  });
}

function settlePendingStarResolution(room: Room, roomCode: string, now = Date.now()): boolean {
  const pending = pendingStarResolutions.get(roomCode);
  if (!pending) return false;
  clearPendingStarResolution(roomCode);
  const result = settleStar(toDomainMatch(room), room.hostId, pending.effect, { now, roundFlipMs: scaledDuration(ROUND_OUT_FLIP_MS) });
  if (!result.ok) return false;
  const applied = applyDomainResult(room, result);
  if (!applied.applied) return false;
  translateStarEvents(room, roomCode, applied.events);
  materializeCardEffects(roomCode, applied.effects);
  emitRoomUpdate(roomCode);
  return true;
}

function materializeStarEffect(roomCode: string, effect: DomainEffect): void {
  if (effect.trigger !== 'star-settled') return;
  clearStarResolutionTimer(roomCode);
  const timer = setTimeout(() => {
    starResolutionTimers.delete(roomCode);
    const room = rooms.get(roomCode);
    if (room) settlePendingStarResolution(room, roomCode, Math.max(Date.now(), effect.dueAt));
  }, Math.max(0, effect.dueAt - Date.now()));
  starResolutionTimers.set(roomCode, timer);
}

function beginStarAnimation(room: Room, roomCode: string, event: Extract<DomainEvent, { type: 'star-used' }>, effects: DomainEffect[]): void {
  const effect = effects.find((candidate) => candidate.trigger === 'star-settled');
  if (!effect) return;
  clearCpuTurn(roomCode);
  const pending = createPendingStarAnimation(event.discarded, room.players, effect);
  pendingStarResolutions.set(roomCode, pending);
  materializeStarEffect(roomCode, effect);
  translateStarEvents(room, roomCode, [event]);
  if (isStarAnimationComplete(pending)) settlePendingStarResolution(room, roomCode);
}

function applyStarResult(room: Room, roomCode: string, result: ReturnType<typeof proposeStar>): boolean {
  if (!result.ok) return false;
  const applied = applyDomainResult(room, result);
  if (!applied.applied) return false;
  const used = applied.events.find((event): event is Extract<DomainEvent, { type: 'star-used' }> => event.type === 'star-used');
  if (used) beginStarAnimation(room, roomCode, used, applied.effects);
  translateStarEvents(room, roomCode, applied.events.filter((event) => event.type !== 'star-used'));
  if (!used) emitRoomUpdate(roomCode);
  return true;
}

function acknowledgeStarDiscardAnimation(roomCode: string, playerId: string, disconnected = false): boolean {
  const room = rooms.get(roomCode);
  const pending = pendingStarResolutions.get(roomCode);
  if (!room || !pending) return false;
  const next = disconnected ? disconnectStarAnimation(pending, playerId) : acknowledgeStarAnimation(pending, playerId);
  if (next !== pending) pendingStarResolutions.set(roomCode, next);
  if (isStarAnimationComplete(next)) settlePendingStarResolution(room, roomCode);
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

  acknowledgeStarDiscardAnimation(roomCode, playerId, true);

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

    const parsed = parseReadyPayload(payload);
    if (!parsed.ok) {
      ack?.({ ok: false, error: 'Invalid ready state' });
      return;
    }
    const result = setRoundReady(toDomainMatch(ctx.room), ctx.playerId, parsed.value.ready, {
      now: Date.now(),
      countdownMs: scaledDuration(ROUND_COUNTDOWN_DELAY_MS),
    });
    if (!result.ok) {
      ack?.({ ok: false, error: result.error });
      return;
    }
    const applied = applyDomainResult(ctx.room, result);
    if (!applied.applied) return;
    if (applied.effects.length) clearCpuTurn(ctx.roomCode);
    materializeDomainEffects(ctx.roomCode, applied.effects);

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

    const startedAt = Date.now();
    const result = startGame(toDomainMatch(ctx.room), ctx.playerId, {
      now: startedAt,
      deck: buildDeck(),
      dealingMs: scaledDuration(getDealLockDuration(1)),
    });
    if (!result.ok) {
      ack?.({ ok: false, error: result.error });
      return;
    }
    clearLevelCompleteTimer(ctx.roomCode);
    clearInteractionLockTimer(ctx.roomCode);
    if (!applyDomainResult(ctx.room, result).applied) return;
    materializeDomainEffects(ctx.roomCode, result.effects);
    emitRoomUpdate(ctx.roomCode);
    io.to(ctx.roomCode).emit('game:started', { version: ctx.room.version, startedAt, message: 'Game started. Get ready...' });
    emitGameLog(ctx.roomCode, 'game:started', { byPlayerId: ctx.room.hostId, byPlayerName: getPlayerName(ctx.room, ctx.room.hostId) });
    ack?.({ ok: true });
  });

  socket.on('game:retry', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx) {
      ack?.({ ok: false, error: 'You are not in a room' });
      return;
    }

    const startedAt = Date.now();
    const result = retryGame(toDomainMatch(ctx.room), ctx.playerId, {
      now: startedAt,
      deck: buildDeck(),
      dealingMs: scaledDuration(getDealLockDuration(1)),
      retryBannerMs: scaledDuration(RESTART_BANNER_DELAY_MS),
    });
    if (!result.ok) {
      ack?.({ ok: false, error: result.error });
      return;
    }
    clearLevelCompleteTimer(ctx.roomCode);
    clearInteractionLockTimer(ctx.roomCode);
    clearPendingStarResolution(ctx.roomCode);
    if (!applyDomainResult(ctx.room, result).applied) return;
    materializeDomainEffects(ctx.roomCode, result.effects);
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
      ack?.(playCardWithDomain(ctx.room, ctx.roomCode, ctx.player, parsed.value.card));
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

    const result = pauseRound(toDomainMatch(ctx.room), ctx.playerId, Date.now());
    if (!result.ok) {
      ack?.({ ok: false, error: result.error });
      return;
    }
    const applied = applyDomainResult(ctx.room, result);
    if (!applied.applied) return;
    clearCpuTurn(ctx.roomCode);

    emitRoomUpdate(ctx.roomCode);
    translatePauseRequest(ctx.room, ctx.roomCode, applied.events);
    ack?.({ ok: true });
  });

  socket.on('star:propose', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game) {
      ack?.({ ok: false, error: 'Invalid game state' });
      return;
    }
    const result = proposeStar(toDomainMatch(ctx.room), ctx.playerId, starInput());
    if (!result.ok) {
      ack?.({ ok: false, error: result.error });
      return;
    }
    applyStarResult(ctx.room, ctx.roomCode, result);
    ack?.({ ok: true });
  });

  socket.on('star:accept', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game || !ctx.room.game.starProposal) {
      ack?.({ ok: false, error: 'There is no active star proposal' });
      return;
    }
    const result = acceptStar(toDomainMatch(ctx.room), ctx.playerId, starInput());
    if (!result.ok) {
      ack?.({ ok: false, error: result.error });
      return;
    }
    applyStarResult(ctx.room, ctx.roomCode, result);
    ack?.({ ok: true });
  });

  socket.on('star:cancel', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game || !ctx.room.game.starProposal) {
      ack?.({ ok: false, error: 'There is no active star proposal' });
      return;
    }
    const result = cancelStar(toDomainMatch(ctx.room), ctx.playerId, Date.now());
    if (!result.ok) {
      ack?.({ ok: false, error: result.error });
      return;
    }
    applyStarResult(ctx.room, ctx.roomCode, result);
    scheduleCpuTurn(ctx.roomCode, 0);
    ack?.({ ok: true });
  });

  socket.on('star:reject', (ack) => {
    const ctx = getSocketContext(socket.id);
    if (!ctx || !ctx.room.game || !ctx.room.game.starProposal) {
      ack?.({ ok: false, error: 'There is no active star proposal' });
      return;
    }
    const result = rejectStar(toDomainMatch(ctx.room), ctx.playerId, Date.now());
    if (!result.ok) {
      ack?.({ ok: false, error: result.error });
      return;
    }
    applyStarResult(ctx.room, ctx.roomCode, result);
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
