/* node:coverage ignore next -- declaration-only contract surface */
export type PrivateActionType =
  | 'ready' | 'unready' | 'round_out_wait' | 'start' | 'play_card'
  | 'pause' | 'propose_star' | 'accept_star' | 'retry';

export type PrivateAction = {
  type: PrivateActionType;
  visible: boolean;
  enabled: boolean;
  reason?: string;
};
