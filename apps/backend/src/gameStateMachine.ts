import type { GamePhase, InteractionLock, InteractionLockReason, RoomStatus } from '@the-hive/contracts';

export type MachinePlayer = {
  id: string;
  connected: boolean;
  ready: boolean;
  hand: number[];
  isCpu?: boolean;
};

export type MachineState = {
  roomStatus: RoomStatus;
  phase: GamePhase | null;
  lock: InteractionLock | null;
  lives: number;
  stars: number;
  hasStarProposal: boolean;
  starInitiatorId: string | null;
  acceptedStarBy: readonly string[];
  isHost: boolean;
  actorId: string;
  players: readonly MachinePlayer[];
  card?: number;
};

export type GameTrigger =
  | 'start' | 'ready' | 'unready' | 'dealing-expired' | 'countdown-expired'
  | 'play' | 'pause' | 'error-expired' | 'propose-star' | 'accept-star'
  | 'cancel-star' | 'reject-star' | 'star-confirmed' | 'star-settled' | 'round-flip-expired'
  | 'round-unflip-expired' | 'next-level-expired' | 'level-ready-expired' | 'retry';

export type TimerEffect = {
  type: 'schedule';
  trigger: Extract<GameTrigger, 'dealing-expired' | 'countdown-expired' | 'error-expired' | 'star-settled' | 'round-flip-expired' | 'round-unflip-expired' | 'next-level-expired' | 'level-ready-expired'>;
  reason?: InteractionLockReason;
  dueAt: number;
  expected: { phase: GamePhase | null; lockReason: InteractionLockReason | null; lockUntil: number | null };
};

export type TransitionDecision =
  | { ok: true; patch: { roomStatus?: RoomStatus; phase?: GamePhase; lock?: InteractionLock | null }; effects: TimerEffect[] }
  | { ok: false; error: string; patch: {}; effects: [] };

const reject = (error: string): TransitionDecision => ({ ok: false, error, patch: {}, effects: [] });

export function isLockActive(lock: InteractionLock | null, now: number): boolean {
  return Boolean(lock && lock.until > now);
}

export function lockError(reason: InteractionLockReason | null): string {
  if (reason === 'dealing') return 'Wait until dealing finishes';
  if (reason === 'level-complete') return 'Wait until the level clear message finishes';
  if (reason === 'countdown') return 'The countdown is already running';
  if (reason === 'star') return 'Wait until the star discard finishes';
  return 'Wait until the current transition finishes';
}

export function readyParticipants(state: MachineState): MachinePlayer[] {
  return state.players.filter((player) => player.connected && player.hand.length > 0);
}

export function playParticipants(state: MachineState): MachinePlayer[] {
  return state.players.filter((player) => player.connected && player.hand.length > 0);
}

export function consensusParticipants(state: MachineState): MachinePlayer[] {
  return state.players.filter((player) => player.connected);
}

export function settlementParticipants(state: MachineState): MachinePlayer[] {
  return state.players.filter((player) => player.hand.length > 0);
}

function actor(state: MachineState): MachinePlayer | undefined {
  return state.players.find((player) => player.id === state.actorId);
}

function lockEffect(trigger: TimerEffect['trigger'], lock: InteractionLock, phase: GamePhase | null): TimerEffect {
  return { type: 'schedule', trigger, reason: lock.reason, dueAt: lock.until, expected: { phase, lockReason: lock.reason, lockUntil: lock.until } };
}

function activeLock(state: MachineState, now: number): InteractionLock | null {
  return isLockActive(state.lock, now) ? state.lock : null;
}

/**
 * Pure authoritative transition inventory. The shell owns all card/life/reward mutation,
 * Socket.IO and timers; this function only accepts/rejects and declares phase/lock changes.
 */
export function evaluateGameTransition(state: MachineState, trigger: GameTrigger, now: number): TransitionDecision {
  const lock = activeLock(state, now);
  const currentPhase = state.phase;
  const currentActor = actor(state);
  const locked = () => reject(lockError(lock?.reason ?? null));

  if (trigger === 'start') {
    if (!state.isHost) return reject('Only the host can start the game');
    if (state.roomStatus !== 'lobby' || currentPhase !== null) return reject('The game already started in this room');
    if (consensusParticipants(state).length < 2) return reject('Need at least 2 connected players');
    return { ok: true, patch: { roomStatus: 'in-game', phase: 'focus' }, effects: [] };
  }
  if (trigger === 'retry') {
    if (!state.isHost) return reject('Only the host can retry');
    if (currentPhase === null) return reject('There is no active game');
    return { ok: true, patch: { roomStatus: 'in-game', phase: 'focus', lock: null }, effects: [] };
  }
  if (trigger === 'dealing-expired') {
    if (currentPhase !== 'focus' || state.lock?.reason !== 'dealing' || isLockActive(state.lock, now)) return reject('Stale timed transition');
    return { ok: true, patch: { lock: null }, effects: [] };
  }
  if (trigger === 'countdown-expired') {
    if ((currentPhase !== 'focus' && currentPhase !== 'paused') || state.lock?.reason !== 'countdown' || isLockActive(state.lock, now)) return reject('Stale timed transition');
    return { ok: true, patch: { phase: 'playing', lock: null }, effects: [] };
  }
  if (trigger === 'error-expired') {
    if (currentPhase !== 'playing' || state.lock?.reason !== 'error' || isLockActive(state.lock, now)) return reject('Stale timed transition');
    return { ok: true, patch: { lock: null }, effects: [] };
  }
  if (trigger === 'star-settled') {
    if (currentPhase !== 'playing' || state.lock?.reason !== 'star' || isLockActive(state.lock, now)) return reject('Stale timed transition');
    return { ok: true, patch: { lock: null }, effects: [] };
  }
  if (trigger === 'round-flip-expired') {
    if ((currentPhase !== 'playing' && currentPhase !== 'paused')) return reject('Stale timed transition');
    return { ok: true, patch: { phase: 'round-complete' }, effects: [] };
  }
  if (trigger === 'round-unflip-expired') {
    if (currentPhase !== 'round-complete') return reject('Stale timed transition');
    return { ok: true, patch: { phase: 'level-complete' }, effects: [] };
  }
  if (trigger === 'next-level-expired') {
    if (currentPhase !== 'level-complete') return reject('Stale timed transition');
    return { ok: true, patch: { phase: 'focus' }, effects: [] };
  }
  if (trigger === 'level-ready-expired') {
    if (currentPhase !== 'focus' || state.lock?.reason !== 'level-complete' || isLockActive(state.lock, now)) return reject('Stale timed transition');
    return { ok: true, patch: { lock: null }, effects: [] };
  }
  if (!currentActor) return reject('Invalid game state');
  if (trigger === 'ready' || trigger === 'unready') {
    if (lock) return locked();
    if ((currentPhase === 'focus' || currentPhase === 'paused') && !readyParticipants(state).some((player) => player.id === currentActor.id)) {
      return reject("You are not part of this round's ready-up");
    }
    return { ok: true, patch: {}, effects: [] };
  }
  if (trigger === 'play') {
    if (lock) return locked();
    if (currentPhase !== 'playing') return reject('The round is not active');
    if (!Number.isInteger(state.card)) return reject('Invalid card');
    if (!currentActor.hand.includes(state.card!)) return reject('You do not have that card');
    if (state.card !== Math.min(...currentActor.hand)) return reject('You must play your lowest card first');
    return { ok: true, patch: {}, effects: [] };
  }
  if (trigger === 'pause') {
    if (currentPhase !== 'playing') return reject('You can only pause during active play');
    if (lock) return locked();
    if (!playParticipants(state).some((player) => player.id === currentActor.id)) return reject('You already finished your cards this round');
    return { ok: true, patch: { phase: 'paused' }, effects: [] };
  }
  if (trigger === 'propose-star') {
    if (currentPhase !== 'playing') return reject('You can only propose a star during active play');
    if (lock) return locked();
    if (state.stars <= 0) return reject('No stars left');
    if (!playParticipants(state).some((player) => player.id === currentActor.id)) return reject('You already finished your cards this round');
    if (state.hasStarProposal) return reject('There is already an active star proposal');
    return { ok: true, patch: {}, effects: [] };
  }
  if (trigger === 'accept-star') {
    if (!state.hasStarProposal) return reject('There is no active star proposal');
    if (currentPhase !== 'playing') return reject('You can only accept a star during active play');
    if (lock) return locked();
    if (!consensusParticipants(state).some((player) => player.id === currentActor.id)) return reject('Invalid game state');
    if (state.acceptedStarBy.includes(currentActor.id)) return { ok: true, patch: {}, effects: [] };
    return { ok: true, patch: {}, effects: [] };
  }
  if (trigger === 'star-confirmed') {
    if (currentPhase !== 'playing' || state.lock?.reason !== 'star') return reject('Stale timed transition');
    return { ok: true, patch: {}, effects: [] };
  }
  if (trigger === 'cancel-star') {
    if (!state.hasStarProposal) return reject('There is no active star proposal');
    if (currentPhase !== 'playing') return reject('You can only cancel a star during active play');
    if (lock) return locked();
    if (!playParticipants(state).some((player) => player.id === currentActor.id)) return reject('You already finished your cards this round');
    if (state.starInitiatorId !== currentActor.id) return reject('Only the proposing player can cancel the star');
    return { ok: true, patch: {}, effects: [] };
  }
  if (trigger === 'reject-star') {
    if (!state.hasStarProposal) return reject('There is no active star proposal');
    if (currentPhase !== 'playing') return reject('You can only reject a star during active play');
    if (lock) return locked();
    if (state.starInitiatorId === currentActor.id) return reject('The proposing player must cancel the star directly');
    return { ok: true, patch: {}, effects: [] };
  }
  return reject('Invalid game state');
}

export function commandDecision(state: MachineState, command: 'start' | 'ready' | 'unready' | 'play' | 'pause' | 'propose-star' | 'accept-star' | 'cancel-star' | 'reject-star' | 'retry', now: number): TransitionDecision {
  return evaluateGameTransition(state, command, now);
}
