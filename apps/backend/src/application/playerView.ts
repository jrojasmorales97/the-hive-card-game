import { commandDecision, type MachineState } from '../domain/stateMachine.js';

export type PlayerCapabilities = { canStart: boolean; canRetry: boolean; canReady: boolean; canPlay: boolean; canPause: boolean };

/** Clock-injected, wire-agnostic capability projection for private presenters. */
export function playerCapabilities(state: MachineState, now: number): PlayerCapabilities {
  const player = state.players.find((entry) => entry.id === state.actorId);
  const readyCommand = player?.ready ? 'unready' : 'ready';
  const playCard = player?.hand[0];
  return {
    canStart: commandDecision(state, 'start', now).ok,
    canRetry: commandDecision(state, 'retry', now).ok,
    canReady: commandDecision(state, readyCommand, now).ok,
    canPlay: playCard !== undefined && commandDecision({ ...state, card: playCard }, 'play', now).ok,
    canPause: commandDecision(state, 'pause', now).ok,
  };
}
