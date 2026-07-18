/* node:coverage ignore next -- declaration-only contract surface */
export type StarDiscardPreview = { card: number; playerId: string; playerName: string };
export type StarUsedPayload = { version: number; message: string; discarded: StarDiscardPreview[] };
