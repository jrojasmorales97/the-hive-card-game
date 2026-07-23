import type { InteractionLockReason, PrivateAction, PrivateActionType } from '@the-hive/contracts';
import { commandDecision, type MachineState } from './domain/stateMachine.js';
export type { InteractionLockReason, PrivateAction, PrivateActionType } from '@the-hive/contracts';

export type PrivateActionContext = {
  roomStatus: 'lobby' | 'in-game';
  phase: 'focus' | 'playing' | 'paused' | 'round-complete' | 'level-complete' | 'game-over' | 'victory' | null;
  isHost: boolean;
  ready: boolean;
  handCount: number;
  connectedPlayerCount: number;
  canStartGame: boolean;
  interactionLocked: boolean;
  interactionLockReason: InteractionLockReason | null;
  stars: number;
  hasStarProposal: boolean;
  alreadyAcceptedStar: boolean;
  isStarProposalInitiator: boolean;
  isRoundReadyParticipant: boolean;
  isActiveRoundParticipant: boolean;
  canParticipateInStarConsensus: boolean;
  inRoundReadyWindow: boolean;
  canRetry: boolean;
  /** Runtime callers provide the same snapshot used by command handlers. */
  machineState?: MachineState;
  now?: number;
};

function blockedReason(lockReason: InteractionLockReason | null): string {
  if (lockReason === 'dealing') return 'Wait until dealing finishes';
  if (lockReason === 'level-complete') return 'Wait until the level clear message finishes';
  if (lockReason === 'countdown') return 'The countdown is already running';
  if (lockReason === 'star') return 'Wait until the star discard finishes';
  if (lockReason === 'error') return 'Wait until the current transition finishes';
  return 'Wait until the current transition finishes';
}

function action(type: PrivateActionType, visible: boolean, enabled: boolean, reason?: string): PrivateAction {
  return { type, visible, enabled, ...(reason ? { reason } : {}) };
}

export function buildPrivateActions(ctx: PrivateActionContext): PrivateAction[] {
  const readyVisible = ctx.isRoundReadyParticipant && !ctx.ready && ctx.inRoundReadyWindow;
  const unreadyVisible = ctx.isRoundReadyParticipant && ctx.ready && ctx.inRoundReadyWindow;
  const roundOutWaitVisible = !ctx.isRoundReadyParticipant && ctx.inRoundReadyWindow;
  const startVisible = ctx.roomStatus === 'lobby' && ctx.isHost;
  const playVisible = ctx.handCount > 0;
  const pauseVisible = ctx.phase === 'playing' && ctx.isActiveRoundParticipant;
  const proposeStarVisible = ctx.phase === 'playing' && ctx.isActiveRoundParticipant;
  const acceptStarVisible = ctx.phase === 'playing' && ctx.canParticipateInStarConsensus && ctx.hasStarProposal;
  const cancelStarVisible = ctx.phase === 'playing' && ctx.hasStarProposal && ctx.isStarProposalInitiator;
  const rejectStarVisible = ctx.phase === 'playing' && ctx.hasStarProposal && !ctx.isStarProposalInitiator && ctx.canParticipateInStarConsensus;
  const retryVisible = ctx.isHost && ctx.canRetry;
  const lockReason = ctx.interactionLocked ? blockedReason(ctx.interactionLockReason) : undefined;

  const actions = [
    action('ready', readyVisible, readyVisible && !ctx.interactionLocked, readyVisible && ctx.interactionLocked ? lockReason : undefined),
    action(
      'unready',
      unreadyVisible,
      unreadyVisible && !ctx.interactionLocked,
        unreadyVisible && ctx.interactionLocked ? lockReason : undefined,
      ),
    action(
      'round_out_wait',
      roundOutWaitVisible,
      false,
      roundOutWaitVisible ? 'The hive is resolving the round without your swarm' : undefined,
    ),
    action(
      'start',
      startVisible,
      startVisible && ctx.canStartGame,
      startVisible && !ctx.canStartGame ? 'Need at least 2 connected players' : undefined,
    ),
    action(
      'play_card',
      playVisible,
      playVisible && ctx.phase === 'playing' && !ctx.interactionLocked && ctx.isActiveRoundParticipant,
      playVisible && (ctx.phase !== 'playing' || ctx.interactionLocked)
        ? ctx.phase !== 'playing'
          ? 'The round is not active'
          : lockReason
        : undefined,
    ),
    action('pause', pauseVisible, pauseVisible && !ctx.interactionLocked, pauseVisible && ctx.interactionLocked ? lockReason : undefined),
    action(
      'propose_star',
      proposeStarVisible,
      proposeStarVisible && ctx.stars > 0 && !ctx.hasStarProposal && !ctx.interactionLocked,
      proposeStarVisible
        ? ctx.stars <= 0
          ? 'No stars left'
          : ctx.hasStarProposal
            ? 'There is already an active star proposal'
            : ctx.interactionLocked
              ? lockReason
              : undefined
        : undefined,
    ),
    action(
      'accept_star',
      acceptStarVisible,
      acceptStarVisible && !ctx.alreadyAcceptedStar && !ctx.interactionLocked,
      acceptStarVisible
        ? ctx.alreadyAcceptedStar
          ? 'You already accepted the star'
          : ctx.interactionLocked
            ? lockReason
            : undefined
        : undefined,
    ),
    action('cancel_star', cancelStarVisible, cancelStarVisible && !ctx.interactionLocked, cancelStarVisible && ctx.interactionLocked ? lockReason : undefined),
    action('reject_star', rejectStarVisible, rejectStarVisible && !ctx.interactionLocked, rejectStarVisible && ctx.interactionLocked ? lockReason : undefined),
    action('retry', retryVisible, retryVisible, retryVisible ? undefined : 'Only the host can retry'),
  ];

  if (!ctx.machineState) return actions;

  const commands: Partial<Record<PrivateActionType, Parameters<typeof commandDecision>[1]>> = {
    start: 'start', ready: 'ready', unready: 'unready', play_card: 'play', pause: 'pause',
    propose_star: 'propose-star', accept_star: 'accept-star', cancel_star: 'cancel-star',
    reject_star: 'reject-star', retry: 'retry',
  };
  return actions.map((current) => {
    const command = commands[current.type];
    if (!command || !current.visible) return current;
    const snapshot = command === 'play'
      ? { ...ctx.machineState!, card: ctx.machineState!.players.find((player) => player.id === ctx.machineState!.actorId)?.hand[0] }
      : ctx.machineState!;
    const decision = commandDecision(snapshot, command, ctx.now ?? Date.now());
    // An already-recorded vote remains idempotent on the wire but is not an actionable UI command.
    if (current.type === 'accept_star' && ctx.alreadyAcceptedStar) return current;
    return decision.ok
      ? { ...current, enabled: true, reason: undefined }
      : { ...current, enabled: false, reason: decision.error };
  });
}
