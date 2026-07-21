import type { PrivateAction } from '@the-hive/contracts';

type CommandAction = {
  key: string;
  label: string;
  icon: string;
  className: string;
  disabled: boolean;
};

type BuildCommandActionsInput = {
  readyAction?: PrivateAction;
  unreadyAction?: PrivateAction;
  roundOutWaitAction?: PrivateAction;
  startAction?: PrivateAction;
  pauseAction?: PrivateAction;
  proposeStarAction?: PrivateAction;
  acceptStarAction?: PrivateAction;
  cancelStarAction?: PrivateAction;
  rejectStarAction?: PrivateAction;
  showCancelStar: boolean;
  showAcceptStar: boolean;
  showRejectStar: boolean;
  showProposeStar: boolean;
  showHivePlaceholder: boolean;
  placeholderLabel: string;
  gameplayOverlayBlocked: boolean;
  /** Presentation-only legacy inputs; command authorization never reads them. */
  isPlaying?: boolean;
  interactionBlocked?: boolean;
  isInGame: boolean;
  phase: string | null;
};

export function gameplayControlDisabled(actionEnabled: boolean | undefined, gameplayOverlayBlocked: boolean): boolean {
  return !actionEnabled || gameplayOverlayBlocked;
}

export function buildCommandActions(input: BuildCommandActionsInput): CommandAction[] {
  const showReady = Boolean(input.readyAction?.visible);
  const showNotReady = Boolean(input.unreadyAction?.visible);
  const showRoundOutWait = Boolean(input.roundOutWaitAction?.visible);
  const showStart = Boolean(input.startAction?.visible);
  const showPause = Boolean(input.pauseAction?.visible);
  const showHivePlaceholderAction =
    (input.showHivePlaceholder || showRoundOutWait) &&
    !showReady &&
    !showNotReady &&
    !showStart &&
    !showPause &&
    !input.showProposeStar &&
    !input.showCancelStar &&
    !input.showAcceptStar &&
    !input.showRejectStar;
  const roundOutLabel = input.roundOutWaitAction?.reason ?? input.placeholderLabel;

  const baseCommandActions = [
    input.showCancelStar
      ? {
          key: 'cancel-star',
          label: 'Retirar propuesta',
          icon: 'star',
          className: 'command-button star full-span',
          disabled: gameplayControlDisabled(input.cancelStarAction?.enabled, input.gameplayOverlayBlocked),
        }
      : null,
    input.showAcceptStar
      ? {
          key: 'accept-star',
          label: 'Accept star',
          icon: 'handshake',
          className: 'command-button pulse',
          disabled: gameplayControlDisabled(input.acceptStarAction?.enabled, input.gameplayOverlayBlocked),
        }
      : null,
    input.showRejectStar
      ? {
          key: 'reject-star',
          label: 'Reject star',
          icon: 'close',
          className: 'command-button secondary',
          disabled: gameplayControlDisabled(input.rejectStarAction?.enabled, input.gameplayOverlayBlocked),
        }
      : null,
    input.showProposeStar
      ? {
          key: 'star',
          label: 'Propose star',
          icon: 'star',
          className: 'command-button star',
          disabled: gameplayControlDisabled(input.proposeStarAction?.enabled, input.gameplayOverlayBlocked),
        }
      : null,
    showPause && !input.showCancelStar && !input.showAcceptStar && !input.showRejectStar
      ? {
          key: 'pause',
          label: 'Pause',
          icon: 'pause',
          className: `command-button secondary${input.showProposeStar ? '' : ' full-span'}`,
          disabled: gameplayControlDisabled(input.pauseAction?.enabled, input.gameplayOverlayBlocked),
        }
      : null,
    showStart
      ? {
          key: 'start',
          label: 'Start',
          icon: 'play_arrow',
          className: 'command-button',
          disabled: gameplayControlDisabled(input.startAction?.enabled, input.gameplayOverlayBlocked),
        }
      : null,
    showReady
      ? {
          key: 'ready',
          label: 'Ready',
          icon: 'task_alt',
          className: 'command-button pulse',
          disabled: gameplayControlDisabled(input.readyAction?.enabled, input.gameplayOverlayBlocked),
        }
      : null,
    showNotReady
      ? input.showHivePlaceholder
        ? {
            key: 'hive-sync',
            label: input.placeholderLabel,
            icon: 'hive',
            className: 'command-button secondary prep-placeholder',
            disabled: true,
          }
        : {
            key: 'waiting',
            label: 'Waiting',
            icon: 'hourglass_top',
            className: 'command-button secondary',
            disabled: gameplayControlDisabled(input.unreadyAction?.enabled, input.gameplayOverlayBlocked),
          }
      : null,
    showHivePlaceholderAction
      ? {
          key: 'hive-sync',
          label: showRoundOutWait ? roundOutLabel : input.placeholderLabel,
          icon: 'hive',
          className: 'command-button secondary prep-placeholder',
          disabled: true,
        }
      : null,
  ].filter(Boolean) as CommandAction[];

  if (baseCommandActions.length > 0) return baseCommandActions;

  if (input.isInGame && input.phase !== 'victory' && input.phase !== 'game-over') {
    return [
      {
        key: 'hive-sync',
        label: showRoundOutWait ? roundOutLabel : input.placeholderLabel,
        icon: 'hive',
        className: 'command-button secondary prep-placeholder layout-placeholder',
        disabled: true,
      },
    ];
  }

  return [];
}
