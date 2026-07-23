import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Server } from 'socket.io';
import type {
  ClientToServerEvents,
  GameLogEvent,
  ServerToClientEvents,
  GamePhase,
  RoomStatus,
} from '@the-hive/contracts';
import { pathToFileURL } from 'node:url';
import type { DomainFinalPlayerResult as FinalPlayerResult, DomainRewardType as RewardType } from './domain/model.js';
import {
  ERROR_LOCK_MS,
  LEVEL_COMPLETE_LOCK_MS,
  getDealLockDuration,
  type InteractionLock,
} from './gameTiming.js';
import { RoomUseCases } from './application/roomUseCases.js';
import { GameUseCases } from './application/gameUseCases.js';
import { EffectUseCases } from './application/effectUseCases.js';
import { StarUseCases } from './application/starUseCases.js';
import type { ApplicationRoom } from './application/model.js';
import type { Scheduler } from './application/ports/scheduler.js';
import { ProcessScheduler } from './infrastructure/scheduling/processScheduler.js';
import { InMemoryRoomRepository } from './infrastructure/memory/inMemoryRoomRepository.js';
import { SessionRegistry } from './transport/socket/sessionRegistry.js';
import { RoomPresenter } from './transport/socket/roomPresenter.js';
import { SocketEventPublisher } from './transport/socket/socketEventPublisher.js';
import { registerRoomHandlers } from './transport/socket/registerRoomHandlers.js';
import { registerGameHandlers } from './transport/socket/registerGameHandlers.js';

type Player = {
  id: string;
  name: string;
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

const roomRepository = new InMemoryRoomRepository();
const sessions = new SessionRegistry();
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
let roomUseCases: RoomUseCases;
let gameUseCases: GameUseCases;
let effectUseCases: EffectUseCases;
let starUseCases: StarUseCases;
let roomPresenter: RoomPresenter;
let socketEventPublisher: SocketEventPublisher;
let applicationScheduler: Scheduler;

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
  roomPresenter = new RoomPresenter(() => Date.now());
  socketEventPublisher = new SocketEventPublisher(
    io,
    (code) => roomRepository.current(code) as unknown as ApplicationRoom & { logs: GameLogEvent[] } | undefined,
    sessions,
    roomPresenter,
    () => Date.now(),
  );
  const processScheduler = new ProcessScheduler((effect) => { effectUseCases.materialize(effect); }, () => Date.now());
  applicationScheduler = {
    schedule: (roomCode, key, effect) => processScheduler.schedule(roomCode, key, effect),
    cancel: (roomCode, key) => processScheduler.cancel(roomCode, key),
    cancelRoom: (roomCode) => { processScheduler.cancelRoom(roomCode); clearRoomTimers(roomCode); },
  };
  roomUseCases = new RoomUseCases({
    rooms: roomRepository,
    publisher: socketEventPublisher,
    scheduler: applicationScheduler,
    random: { next: () => random() },
  });
  gameUseCases = new GameUseCases({
    rooms: roomRepository,
    publisher: socketEventPublisher,
    scheduler: applicationScheduler,
    clock: { now: () => Date.now() },
    random: { next: () => random() },
    dealingDuration: (level) => scaledDuration(getDealLockDuration(level)),
    countdownDuration: () => scaledDuration(ROUND_COUNTDOWN_DELAY_MS),
    retryBannerMs: scaledDuration(RESTART_BANNER_DELAY_MS),
    cardDurations: () => ({ errorOverlayMs: scaledDuration(ERROR_LOCK_MS), roundFlipMs: scaledDuration(ROUND_OUT_FLIP_MS), roundUnflipMs: scaledDuration(ROUND_OUT_UNFLIP_MS) }),
    cpuDelay: () => scaledDuration(DEV_CPU_PLAY_DELAY_MS),
  });
  effectUseCases = new EffectUseCases({
    rooms: roomRepository,
    publisher: socketEventPublisher,
    scheduler: applicationScheduler,
    clock: { now: () => Date.now() },
    countdownMs: scaledDuration(ROUND_COUNTDOWN_DELAY_MS),
    random: { next: () => random() },
    cardDurations: () => ({ errorOverlayMs: scaledDuration(ERROR_LOCK_MS), roundFlipMs: scaledDuration(ROUND_OUT_FLIP_MS), roundUnflipMs: scaledDuration(ROUND_OUT_UNFLIP_MS) }),
    levelCompleteMs: () => scaledDuration(LEVEL_COMPLETE_LOCK_MS),
    dealingDuration: (level) => scaledDuration(getDealLockDuration(level)),
    cpuDelay: () => scaledDuration(DEV_CPU_PLAY_DELAY_MS),
    retryBannerMs: scaledDuration(RESTART_BANNER_DELAY_MS),
  });
  starUseCases = new StarUseCases({
    rooms: roomRepository,
    publisher: socketEventPublisher,
    scheduler: applicationScheduler,
    clock: { now: () => Date.now() },
    resolutionMs: () => scaledDuration(5000),
    roundFlipMs: () => scaledDuration(ROUND_OUT_FLIP_MS),
    cpuDelay: () => scaledDuration(DEV_CPU_PLAY_DELAY_MS),
  });
  registerGameHandlers({
    io,
    sessions,
    games: gameUseCases,
    stars: starUseCases,
    getRoom: (code) => roomRepository.get(code),
  });
  registerRoomHandlers({
    io,
    useCases: roomUseCases,
    sessions,
    presenter: roomPresenter,
    getRoom: (code) => roomRepository.get(code),
    findRoomCodeByPlayer: (playerId) => roomRepository.findRoomCodeByPlayer(playerId),
    resolveJoinRoom: (requestedRoomCode, playerId) => resolveJoinRoom(requestedRoomCode, playerId),
    isValidPlayerId,
    onPlayerDisconnected: (roomCode, playerId) => { starUseCases.completeStarAnimation({ roomCode, playerId }); },
  });
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
  while (roomRepository.has(code)) code = generateRoomCode();
  return code;
}

function scaledDuration(durationMs: number): number {
  return Math.max(0, durationMs * timingScale);
}

function clearRoomTimers(roomCode: string): void {
  void roomCode;
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

  roomRepository.save(room as unknown as ApplicationRoom, 0);
  app.log.info({ roomCode, cpuPlayers }, 'CPU room ready');
  return room;
}

function resolveJoinRoom(requestedRoomCode: string, playerId: string): { roomCode: string } | { error: string } {
  const room = roomRepository.get(requestedRoomCode);
  if (!room) {
    const cpuPlayers = parseCpuRoomCode(requestedRoomCode);
    if (!cpuPlayers) return { error: 'That room does not exist' };
    const roomCode = createUniqueRoomCode();
    createCpuRoom(roomCode, cpuPlayers, requestedRoomCode);
    return { roomCode };
  }
  if (room.shareable === false && !room.players[playerId]) return { error: 'This private room cannot be shared' };
  return { roomCode: room.code };
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
  for (const roomCode of roomRepository.roomCodes()) applicationScheduler?.cancelRoom(roomCode);
  roomRepository.clear();
  sessions.clear();
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
