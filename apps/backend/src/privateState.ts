import type { InteractionLockReason, PrivateAction, PrivateActionType } from '@the-hive/contracts';
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
  isRoundReadyParticipant: boolean;
  isActiveRoundParticipant: boolean;
  canParticipateInStarConsensus: boolean;
  inRoundReadyWindow: boolean;
  canRetry: boolean;
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
  const retryVisible = ctx.isHost && ctx.canRetry;
  const lockReason = ctx.interactionLocked ? blockedReason(ctx.interactionLockReason) : undefined;

  return [
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
    action('retry', retryVisible, retryVisible, retryVisible ? undefined : 'Only the host can retry'),
  ];
}
