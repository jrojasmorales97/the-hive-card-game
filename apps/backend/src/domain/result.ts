import type { DomainGamePhase, DomainInteractionLockReason, DomainMatch, DomainStarDiscardPreview } from './model.js';

export type DomainEvent =
  | { type: 'game-started'; startedAt: number }
  | { type: 'game-restarted'; startedAt: number }
  | { type: 'card-played'; playerId: string; card: number }
  | { type: 'error-penalty'; playerId: string; card: number; blockingCards: Array<{ value: number; playerId: string }>; lifeLost: number }
  | { type: 'card-discarded'; playerId: string; card: number; reason: 'error' | 'star' }
  | { type: 'card-outcome'; outcome: 'game-over' | 'level-complete' | 'pause' }
  | { type: 'round-pause-requested'; playerId: string }
  | { type: 'star-proposed'; playerId: string }
  | { type: 'star-accepted'; playerId: string }
  | { type: 'star-used'; playerId: string; discarded: DomainStarDiscardPreview[] }
  | { type: 'star-settled'; playerId: string; discarded: DomainStarDiscardPreview[] }
  | { type: 'star-outcome'; outcome: 'game-over' | 'level-complete' | 'pause' }
  | { type: 'level-completed'; level: number; reward: 'life' | 'star' | null }
  | { type: 'reward-applied'; reward: 'life' | 'star' }
  | { type: 'next-level-ready'; level: number }
  | { type: 'game-over' }
  | { type: 'victory' }
  | { type: 'game-restarted' };

export type DomainEffect = {
  type: 'schedule';
  trigger: string;
  dueAt: number;
  expected: { phase: DomainGamePhase | null; lockReason: DomainInteractionLockReason | null; lockUntil: number | null };
};

export type DomainResult =
  | { ok: false; error: string }
  | { ok: true; state: DomainMatch; events: DomainEvent[]; effects: DomainEffect[] };

export function rejected(error: string): DomainResult {
  return { ok: false, error };
}

export function succeeded(state: DomainMatch, events: DomainEvent[] = [], effects: DomainEffect[] = []): DomainResult {
  return { ok: true, state, events, effects };
}
