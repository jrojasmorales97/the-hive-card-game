import { pathToFileURL } from 'node:url';
import type { GameLogEvent } from '@the-hive/contracts';
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
import type { Clock } from './application/ports/clock.js';
import type { RandomSource } from './application/ports/randomSource.js';
import { ProcessScheduler } from './infrastructure/scheduling/processScheduler.js';
import { InMemoryRoomRepository } from './infrastructure/memory/inMemoryRoomRepository.js';
import { SystemClock } from './infrastructure/runtime/systemClock.js';
import { SystemRandomSource } from './infrastructure/runtime/systemRandomSource.js';
import { CpuRoomAccess } from './infrastructure/cpu/cpuRoomAccess.js';
import { SessionRegistry } from './transport/socket/sessionRegistry.js';
import { RoomPresenter } from './transport/socket/roomPresenter.js';
import { SocketEventPublisher } from './transport/socket/socketEventPublisher.js';
import { registerRoomHandlers } from './transport/socket/registerRoomHandlers.js';
import { registerGameHandlers } from './transport/socket/registerGameHandlers.js';
import { createHttpSocketTransport } from './transport/http/createHttpSocketTransport.js';

const roomRepository = new InMemoryRoomRepository();
const sessions = new SessionRegistry();
let clock: Clock = new SystemClock();
let randomSource: RandomSource = new SystemRandomSource();
let timingScale = 1;
let listening = false;

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? 'http://localhost:5173';
const ALLOW_ALL_ORIGINS = CLIENT_ORIGIN.trim() === '*';
const DEV_CPU_PLAY_DELAY_MS = clampNumber(Number(process.env.DEV_CPU_PLAY_DELAY_MS ?? 900), 100, 10_000);
const ROUND_COUNTDOWN_DELAY_MS = 3000;
const ROUND_OUT_FLIP_MS = 520;
const ROUND_OUT_UNFLIP_MS = 520;
const RESTART_BANNER_DELAY_MS = 5000;

let app: Awaited<ReturnType<typeof createHttpSocketTransport>>['app'];
let io: Awaited<ReturnType<typeof createHttpSocketTransport>>['io'];
let roomUseCases: RoomUseCases;
let gameUseCases: GameUseCases;
let effectUseCases: EffectUseCases;
let starUseCases: StarUseCases;
let roomPresenter: RoomPresenter;
let socketEventPublisher: SocketEventPublisher;
let applicationScheduler: Scheduler;
let processScheduler: ProcessScheduler | undefined;

async function createTransport(): Promise<void> {
  ({ app, io } = await createHttpSocketTransport(ALLOW_ALL_ORIGINS ? '*' : CLIENT_ORIGIN));
  roomPresenter = new RoomPresenter(clock);
  socketEventPublisher = new SocketEventPublisher(
    io,
    (code) => roomRepository.current(code) as unknown as ApplicationRoom & { logs: GameLogEvent[] } | undefined,
    sessions,
    roomPresenter,
    clock,
  );
  processScheduler = new ProcessScheduler((effect) => { effectUseCases.materialize(effect); }, clock);
  applicationScheduler = {
    schedule: (roomCode, key, effect) => processScheduler!.schedule(roomCode, key, effect),
    cancel: (roomCode, key) => processScheduler!.cancel(roomCode, key),
    cancelRoom: (roomCode) => processScheduler!.cancelRoom(roomCode),
    cancelAll: () => processScheduler!.cancelAll(),
    rebaseRoom: (roomCode, previousVersion, nextVersion) => processScheduler!.rebaseRoom(roomCode, previousVersion, nextVersion),
  };
  roomUseCases = new RoomUseCases({
    rooms: roomRepository,
    publisher: socketEventPublisher,
    scheduler: applicationScheduler,
    random: randomSource,
  });
  gameUseCases = new GameUseCases({
    rooms: roomRepository,
    publisher: socketEventPublisher,
    scheduler: applicationScheduler,
    clock,
    random: randomSource,
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
    clock,
    countdownMs: scaledDuration(ROUND_COUNTDOWN_DELAY_MS),
    random: randomSource,
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
    clock,
    resolutionMs: () => scaledDuration(5000),
    roundFlipMs: () => scaledDuration(ROUND_OUT_FLIP_MS),
    cpuDelay: () => scaledDuration(DEV_CPU_PLAY_DELAY_MS),
  });
  const cpuRooms = new CpuRoomAccess({
    rooms: roomRepository,
    random: randomSource,
    onRoomCreated: (roomCode, cpuPlayers) => app.log.info({ roomCode, cpuPlayers }, 'CPU room ready'),
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
    clock,
    getRoom: (code) => roomRepository.get(code),
    findRoomCodeByPlayer: (playerId) => roomRepository.findRoomCodeByPlayer(playerId),
    resolveJoinRoom: (requestedRoomCode, playerId) => cpuRooms.resolveJoinRoom(requestedRoomCode, playerId),
    isValidPlayerId,
    onPlayerDisconnected: (roomCode, playerId) => { starUseCases.playerDeparted({ roomCode, playerId }); },
  });
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

function scaledDuration(durationMs: number): number {
  return Math.max(0, durationMs * timingScale);
}

function isValidPlayerId(playerId: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(playerId);
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

  clock = new SystemClock();
  randomSource = new SystemRandomSource(options.random);
  timingScale = Number.isFinite(options.timingScale) ? Math.max(0, options.timingScale!) : 1;
  if (!app) await createTransport();
  const host = options.host ?? '0.0.0.0';
  await app.listen({ port: options.port ?? PORT, host });
  listening = true;
  const address = app.server.address();
  const port = address && typeof address !== 'string' ? address.port : options.port ?? PORT;
  return { url: `http://${host === '0.0.0.0' ? '127.0.0.1' : host}:${port}`, port };
}

export function resetServerForTests(): void {
  applicationScheduler?.cancelAll();
  roomRepository.clear();
  sessions.clear();
}

/** In-process test seam; never registered on the production HTTP transport. */
export function seedRoomForTests(room: ApplicationRoom): void {
  applicationScheduler.cancelRoom(room.code);
  const previous = roomRepository.get(room.code);
  roomRepository.save(room, previous?.version ?? 0);
  socketEventPublisher.emitRoomUpdate(room.code, false);
}

export function inspectRoomForTests(code: string): ApplicationRoom | undefined {
  return roomRepository.get(code);
}

export function deleteRoomForTests(code: string): void {
  applicationScheduler.cancelRoom(code);
  for (const player of Object.values(roomRepository.get(code)?.players ?? {})) sessions.removePlayer(player.id);
  roomRepository.delete(code);
}

export async function stopServer(): Promise<void> {
  resetServerForTests();
  if (listening) await io.close();
  listening = false;
  app = undefined as unknown as Awaited<ReturnType<typeof createHttpSocketTransport>>['app'];
  processScheduler = undefined;
  clock = new SystemClock();
  randomSource = new SystemRandomSource();
  timingScale = 1;
}

const isDirectEntry = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectEntry) await startServer();
