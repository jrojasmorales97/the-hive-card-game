import type { DomainPlayer } from './model.js';

export type ParticipantPlayer = Pick<DomainPlayer, 'connected' | 'ready' | 'hand'>;
export type ParticipantMatch<TPlayer extends ParticipantPlayer = ParticipantPlayer> = { players: readonly TPlayer[] };

/** Connected players that still carry cards decide the ready quorum. */
export function readyParticipants<TPlayer extends ParticipantPlayer>(match: ParticipantMatch<TPlayer>): TPlayer[] {
  return match.players.filter((player) => player.connected && player.hand.length > 0);
}

/** Playing a card is limited to connected players that still carry cards. */
export function playParticipants<TPlayer extends ParticipantPlayer>(match: ParticipantMatch<TPlayer>): TPlayer[] {
  return match.players.filter((player) => player.connected && player.hand.length > 0);
}

/** Pausing uses the same active-round population as playing. */
export function pauseParticipants<TPlayer extends ParticipantPlayer>(match: ParticipantMatch<TPlayer>): TPlayer[] {
  return match.players.filter((player) => player.connected && player.hand.length > 0);
}

/** Star consensus includes every connected player, including players without cards. */
export function consensusParticipants<TPlayer extends ParticipantPlayer>(match: ParticipantMatch<TPlayer>): TPlayer[] {
  return match.players.filter((player) => player.connected);
}

/** Star settlement removes a card from every non-empty hand, including disconnected players. */
export function settlementParticipants<TPlayer extends ParticipantPlayer>(match: ParticipantMatch<TPlayer>): TPlayer[] {
  return match.players.filter((player) => player.hand.length > 0);
}

export function hasAllReadyForRound<TPlayer extends ParticipantPlayer>(match: ParticipantMatch<TPlayer>): boolean {
  const participants = readyParticipants(match);
  return participants.length > 0 && participants.every((player) => player.ready);
}
