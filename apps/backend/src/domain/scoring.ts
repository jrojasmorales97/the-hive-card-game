import type { DomainFinalPlayerResult, DomainPileEntry } from './model.js';

type PlayerMeta = { id: string; name: string; isCpu?: boolean };

const LIGHT_DEVIATION_MS = 700;
const MID_DEVIATION_MS = 1800;
const HEAVY_DEVIATION_MS = 3200;
const PERFECT_WINDOW_MS = 450;
const ERROR_PENALTY_PER_ERROR = 12;
const MAX_ERROR_PENALTY = 36;

function clampScore(value: number): number {
  return Math.max(1, Math.min(100, Math.round(value)));
}

function expectedFractionsFromOthers(currentPlayerId: string, playerFractions: Map<string, number[]>, index: number): number[] {
  const fractions: number[] = [];
  playerFractions.forEach((values, playerId) => {
    if (playerId === currentPlayerId || values.length === 0) return;
    const targetIndex = Math.min(values.length - 1, Math.max(0, Math.round(((index + 1) / Math.max(1, values.length)) * values.length) - 1));
    fractions.push(values[targetIndex]);
  });
  return fractions;
}

function classifyDeviation(avgDeviationMs: number): Pick<DomainFinalPlayerResult, 'timingBand' | 'direction'> {
  const abs = Math.abs(avgDeviationMs);
  if (abs <= LIGHT_DEVIATION_MS) return { timingBand: 'sync', direction: 'steady' };
  if (avgDeviationMs < 0) return abs <= MID_DEVIATION_MS
    ? { timingBand: 'slightly-fast', direction: 'fast' }
    : { timingBand: 'very-fast', direction: 'fast' };
  return abs <= MID_DEVIATION_MS
    ? { timingBand: 'slightly-slow', direction: 'slow' }
    : { timingBand: 'very-slow', direction: 'slow' };
}

function buildMessages(playerName: string, timingBand: DomainFinalPlayerResult['timingBand']): Pick<DomainFinalPlayerResult, 'summary' | 'roast'> {
  switch (timingBand) {
    case 'sync': return { summary: 'Good timing. Stay the course.', roast: `${playerName} was locked in. No need to fix what is already spooky-good.` };
    case 'slightly-fast': return { summary: 'A touch fast. Breathe a beat longer.', roast: `${playerName} keeps trying to speedrun the hive. One calmer breath and it lands.` };
    case 'very-fast': return { summary: 'Too fast. Wait more before committing.', roast: `${playerName} heard an imaginary starting pistol and never recovered. Ease off the turbo.` };
    case 'slightly-slow': return { summary: 'A touch slow. Trust the moment sooner.', roast: `${playerName} was almost there, just leaving the cards in dramatic suspense a bit too long.` };
    case 'very-slow': return { summary: 'Too slow. Commit earlier.', roast: `${playerName} was roleplaying a museum curator. These cards are meant to move.` };
    default: return { summary: 'Not enough timing signal to judge fairly.', roast: `${playerName} stayed so mysterious the hive still wants a replay.` };
  }
}

/** Ranks a completed match with supplied timestamps; pile history remains scoped by setup's current-level reset. */
export function calculateFinalResults(input: {
  players: PlayerMeta[];
  plays: DomainPileEntry[];
  gameStartedAt: number;
  completedAt: number;
  errorCounts: Record<string, number>;
}): DomainFinalPlayerResult[] {
  const manualPlays = input.plays.filter((play) => play.source === 'manual').sort((left, right) => left.ts - right.ts);
  const matchStart = input.gameStartedAt;
  const matchDuration = Math.max(1, Math.max(input.completedAt, matchStart + 1) - matchStart);
  const playsByPlayer = new Map(input.players.map((player) => [player.id, [] as DomainPileEntry[]]));
  manualPlays.forEach((play) => playsByPlayer.get(play.playerId)?.push(play));
  const fractionsByPlayer = new Map<string, number[]>();
  playsByPlayer.forEach((plays, playerId) => fractionsByPlayer.set(playerId, plays.map((play) => (play.ts - matchStart) / matchDuration)));

  return input.players.map<DomainFinalPlayerResult>((player) => {
    if (player.isCpu) {
      const messages = buildMessages(player.name, 'sync');
      return { playerId: player.id, playerName: player.name, score: 100, timingBand: 'sync', direction: 'steady', avgDeviationMs: 0, errorPenalty: 0, errorCount: 0, summary: messages.summary, roast: `${player.name} is a cold-blooded metronome. Of course the robot nailed it.` };
    }
    const playerPlays = playsByPlayer.get(player.id) ?? [];
    const deviationsMs = playerPlays.map((play, index) => {
      const others = expectedFractionsFromOthers(player.id, fractionsByPlayer, index);
      if (others.length === 0) return 0;
      return (((play.ts - matchStart) / matchDuration) - (others.reduce((sum, value) => sum + value, 0) / others.length)) * matchDuration;
    });
    const avgDeviationMs = deviationsMs.length ? deviationsMs.reduce((sum, value) => sum + value, 0) / deviationsMs.length : 0;
    const avgAbsDeviationMs = deviationsMs.length ? deviationsMs.reduce((sum, value) => sum + Math.abs(value), 0) / deviationsMs.length : 0;
    const errorCount = input.errorCounts[player.id] ?? 0;
    const errorPenalty = Math.min(MAX_ERROR_PENALTY, errorCount * ERROR_PENALTY_PER_ERROR);
    if (!playerPlays.length) {
      const messages = buildMessages(player.name, 'unrated');
      return { playerId: player.id, playerName: player.name, score: clampScore(72 - errorPenalty), timingBand: 'unrated', direction: 'unknown', avgDeviationMs: 0, errorPenalty, errorCount, summary: messages.summary, roast: messages.roast };
    }
    const score = clampScore(100 - (avgAbsDeviationMs > PERFECT_WINDOW_MS ? ((avgAbsDeviationMs - PERFECT_WINDOW_MS) / HEAVY_DEVIATION_MS) * 42 : 0) - errorPenalty);
    const classified = classifyDeviation(avgDeviationMs);
    const messages = buildMessages(player.name, classified.timingBand);
    return { playerId: player.id, playerName: player.name, score, timingBand: classified.timingBand, direction: classified.direction, avgDeviationMs: Math.round(avgDeviationMs), errorPenalty, errorCount, summary: messages.summary, roast: messages.roast };
  }).sort((left, right) => right.score - left.score || left.avgDeviationMs - right.avgDeviationMs || left.playerName.localeCompare(right.playerName));
}
