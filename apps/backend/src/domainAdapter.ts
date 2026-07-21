/* node:coverage disable -- Type-only shell boundary declarations are erased at runtime. */
import type {
  DomainFinalPlayerResult,
  DomainGame,
  DomainMatch,
  DomainPlayer,
  DomainStarProposal,
} from './domain/model.js';
import type { DomainEffect, DomainEvent, DomainResult } from './domain/result.js';

type RoomPlayer = DomainPlayer & { socketId: string | null };
type RoomGame = Omit<DomainGame, 'starProposal'> & { starProposal: { initiatorId: string; acceptedBy: Set<string> } | null };

/** Minimal shell shape. Transport metadata deliberately remains outside the domain model. */
export type AdaptableRoom = {
  code: string;
  displayCode?: string;
  shareable?: boolean;
  hostId: string;
  status: DomainMatch['status'];
  players: Record<string, RoomPlayer>;
  game: RoomGame | null;
  version: number;
  logs: unknown[];
};
/* node:coverage enable */

function copyPlayer(player: RoomPlayer): DomainPlayer {
  return { id: player.id, name: player.name, connected: player.connected, ready: player.ready, hand: [...player.hand], isCpu: player.isCpu };
}

function copyProposal(proposal: RoomGame['starProposal']): DomainStarProposal | null {
  return proposal ? { initiatorId: proposal.initiatorId, acceptedBy: [...proposal.acceptedBy] } : null;
}

function copyGame(game: RoomGame): DomainGame {
  return {
    ...game,
    pile: [...game.pile],
    pileHistory: game.pileHistory.map((entry) => ({ ...entry })),
    rewardMap: { ...game.rewardMap },
    starProposal: copyProposal(game.starProposal),
    interactionLock: game.interactionLock ? { ...game.interactionLock } : null,
    errorCounts: { ...game.errorCounts },
    finalResults: game.finalResults?.map((result) => ({ ...result })) ?? null,
  };
}

export function toDomainMatch(room: AdaptableRoom): DomainMatch {
  return {
    status: room.status,
    hostId: room.hostId,
    players: Object.fromEntries(Object.entries(room.players).map(([id, player]) => [id, copyPlayer(player)])),
    game: room.game ? copyGame(room.game) : null,
  };
}

function toShellGame(game: DomainGame): RoomGame {
  return {
    ...game,
    pile: [...game.pile],
    pileHistory: game.pileHistory.map((entry) => ({ ...entry })),
    rewardMap: { ...game.rewardMap },
    starProposal: game.starProposal ? { initiatorId: game.starProposal.initiatorId, acceptedBy: new Set(game.starProposal.acceptedBy) } : null,
    interactionLock: game.interactionLock ? { ...game.interactionLock } : null,
    errorCounts: { ...game.errorCounts },
    finalResults: game.finalResults?.map((result: DomainFinalPlayerResult) => ({ ...result })) ?? null,
  };
}

/**
 * A rejection is a strict no-op. A success is prepared first, then functional state is
 * replaced while the room code, display metadata, sockets, version, logs, and timers remain owned by the shell.
 */
export function applyDomainResult(room: AdaptableRoom, result: DomainResult): { applied: boolean; events: DomainEvent[]; effects: DomainEffect[] } {
  if (!result.ok) return { applied: false, events: [], effects: [] };

  const nextPlayers: Record<string, RoomPlayer> = {};
  for (const [id, player] of Object.entries(result.state.players)) {
    const current = room.players[id];
    if (!current) throw new Error(`Domain result cannot add player ${id}`);
    nextPlayers[id] = { ...copyPlayer({ ...current, ...player }), socketId: current.socketId };
  }
  if (Object.keys(nextPlayers).length !== Object.keys(room.players).length) {
    throw new Error('Domain result cannot remove players');
  }
  const nextGame = result.state.game ? toShellGame(result.state.game) : null;

  room.status = result.state.status;
  room.hostId = result.state.hostId;
  room.players = nextPlayers;
  room.game = nextGame;
  return { applied: true, events: result.events, effects: result.effects };
}
