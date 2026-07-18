import type { PrivateAction, PrivateActionType } from '@the-hive/contracts';
export type ActionType = PrivateActionType;
export type AvailableAction = PrivateAction;

export type CommandAction = {
  key: string;
  label: string;
  icon: string;
  className: string;
  disabled: boolean;
};

type BuildCommandActionsInput = {
  readyAction?: AvailableAction;
  unreadyAction?: AvailableAction;
  roundOutWaitAction?: AvailableAction;
  startAction?: AvailableAction;
  pauseAction?: AvailableAction;
  proposeStarAction?: AvailableAction;
  acceptStarAction?: AvailableAction;
  showCancelStar: boolean;
  showAcceptStar: boolean;
  showRejectStar: boolean;
  showProposeStar: boolean;
  showHivePlaceholder: boolean;
  placeholderLabel: string;
  readyOverlayBlocked: boolean;
  isPlaying: boolean;
  interactionBlocked: boolean;
  isInGame: boolean;
  phase: string | null;
};

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
          disabled: !input.isPlaying || input.interactionBlocked,
        }
      : null,
    input.showAcceptStar
      ? {
          key: 'accept-star',
          label: 'Accept star',
          icon: 'handshake',
          className: 'command-button pulse',
          disabled: !input.acceptStarAction?.enabled,
        }
      : null,
    input.showRejectStar
      ? {
          key: 'reject-star',
          label: 'Reject star',
          icon: 'close',
          className: 'command-button secondary',
          disabled: !input.isPlaying || input.interactionBlocked,
        }
      : null,
    input.showProposeStar
      ? {
          key: 'star',
          label: 'Propose star',
          icon: 'star',
          className: 'command-button star',
          disabled: !input.proposeStarAction?.enabled,
        }
      : null,
    showPause && !input.showCancelStar && !input.showAcceptStar && !input.showRejectStar
      ? {
          key: 'pause',
          label: 'Pause',
          icon: 'pause',
          className: `command-button secondary${input.showProposeStar ? '' : ' full-span'}`,
          disabled: !input.pauseAction?.enabled,
        }
      : null,
    showStart
      ? {
          key: 'start',
          label: 'Start',
          icon: 'play_arrow',
          className: 'command-button',
          disabled: !input.startAction?.enabled,
        }
      : null,
    showReady
      ? {
          key: 'ready',
          label: 'Ready',
          icon: 'task_alt',
          className: 'command-button pulse',
          disabled: !input.readyAction?.enabled || input.readyOverlayBlocked,
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
            disabled: !input.unreadyAction?.enabled || input.readyOverlayBlocked,
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
