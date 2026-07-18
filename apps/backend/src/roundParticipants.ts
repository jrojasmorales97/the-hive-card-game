export type RoundReadyPhase = 'focus' | 'playing' | 'paused' | 'round-complete' | 'level-complete' | 'game-over' | 'victory' | null;

export type RoundReadyPlayer = {
  connected: boolean;
  hand: number[];
  ready: boolean;
};

export type RoundReadyRoom<TPlayer extends RoundReadyPlayer = RoundReadyPlayer> = {
  game?: {
    phase: RoundReadyPhase;
  } | null;
  players: Record<string, TPlayer>;
};

export const PAUSE_READY_MESSAGE = 'Pause requested. The hive waits only for players still carrying cards.';

export function createPauseEventPayload(version: number, playerId: string) {
  return { version, by: playerId, message: PAUSE_READY_MESSAGE };
}

export function isConnectedConsensusParticipant<TPlayer extends RoundReadyPlayer>(player: TPlayer): boolean {
  return player.connected;
}

export function isRoundParticipationPhase(phase: RoundReadyPhase): boolean {
  return phase === 'playing' || phase === 'paused';
}

export function isRoundReadyParticipant<TPlayer extends RoundReadyPlayer>(room: RoundReadyRoom<TPlayer>, player: TPlayer): boolean {
  if (!player.connected) return false;

  const phase = room.game?.phase ?? null;
  if (phase === 'focus' || phase === 'playing' || phase === 'paused') {
    return player.hand.length > 0;
  }

  return true;
}

export function validateRoundReadyRequest<TPlayer extends RoundReadyPlayer>(
  room: RoundReadyRoom<TPlayer>,
  player: TPlayer,
): { ok: true } | { ok: false; error: string } {
  const phase = room.game?.phase ?? null;
  if ((phase === 'focus' || phase === 'paused') && !isRoundReadyParticipant(room, player)) {
    return { ok: false, error: "You are not part of this round's ready-up" };
  }

  return { ok: true };
}

export function applyRoundReadyRequest<TPlayer extends RoundReadyPlayer>(
  room: RoundReadyRoom<TPlayer>,
  player: TPlayer,
  ready: boolean,
  syncAutomatedParticipants: () => void = () => {},
): { ok: true; shouldBeginCountdown: boolean } | { ok: false; error: string } {
  const decision = validateRoundReadyRequest(room, player);
  if (!decision.ok) return decision;

  player.ready = ready;
  syncAutomatedParticipants();
  const phase = room.game?.phase ?? null;
  return {
    ok: true,
    shouldBeginCountdown: (phase === 'focus' || phase === 'paused') && hasAllReadyForRound(room),
  };
}

export function isActiveRoundParticipant<TPlayer extends RoundReadyPlayer>(room: RoundReadyRoom<TPlayer>, player: TPlayer): boolean {
  if (!isConnectedConsensusParticipant(player)) return false;
  if (!isRoundParticipationPhase(room.game?.phase ?? null)) return true;
  return player.hand.length > 0;
}

export function getRoundReadyParticipants<TPlayer extends RoundReadyPlayer>(room: RoundReadyRoom<TPlayer>): TPlayer[] {
  return Object.values(room.players).filter((player) => isRoundReadyParticipant(room, player));
}

export function getActiveRoundParticipants<TPlayer extends RoundReadyPlayer>(room: RoundReadyRoom<TPlayer>): TPlayer[] {
  return Object.values(room.players).filter((player) => isActiveRoundParticipant(room, player));
}

export function getConnectedConsensusParticipants<TPlayer extends RoundReadyPlayer>(room: RoundReadyRoom<TPlayer>): TPlayer[] {
  return Object.values(room.players).filter((player) => isConnectedConsensusParticipant(player));
}

export function hasAllReadyForRound(room: RoundReadyRoom): boolean {
  const players = getRoundReadyParticipants(room);
  return players.length > 0 && players.every((player) => player.ready);
}

export function pauseRoundForReady(room: RoundReadyRoom): boolean {
  if (room.game?.phase !== 'playing') return false;

  room.game.phase = 'paused';
  getActiveRoundParticipants(room).forEach((player) => {
    player.ready = false;
  });
  return true;
}
