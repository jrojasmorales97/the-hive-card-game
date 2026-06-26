export type RecordedPlay = {
  value: number;
  playerId: string;
  ts: number;
  source: 'manual' | 'star';
};

export type FinalTimingBand = 'sync' | 'slightly-fast' | 'very-fast' | 'slightly-slow' | 'very-slow' | 'unrated';

export type FinalPlayerResult = {
  playerId: string;
  playerName: string;
  score: number;
  timingBand: FinalTimingBand;
  direction: 'fast' | 'slow' | 'steady' | 'unknown';
  avgDeviationMs: number;
  errorPenalty: number;
  errorCount: number;
  summary: string;
  roast: string;
};

type PlayerMeta = {
  id: string;
  name: string;
  isCpu?: boolean;
};

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

function classifyDeviation(avgDeviationMs: number): { band: FinalTimingBand; direction: FinalPlayerResult['direction'] } {
  const abs = Math.abs(avgDeviationMs);
  if (abs <= LIGHT_DEVIATION_MS) return { band: 'sync', direction: 'steady' };
  if (avgDeviationMs < 0) {
    return abs <= MID_DEVIATION_MS ? { band: 'slightly-fast', direction: 'fast' } : { band: 'very-fast', direction: 'fast' };
  }
  return abs <= MID_DEVIATION_MS ? { band: 'slightly-slow', direction: 'slow' } : { band: 'very-slow', direction: 'slow' };
}

function buildMessages(playerName: string, band: FinalTimingBand): Pick<FinalPlayerResult, 'summary' | 'roast'> {
  switch (band) {
    case 'sync':
      return {
        summary: 'Good timing. Stay the course.',
        roast: `${playerName} was locked in. No need to fix what is already spooky-good.`,
      };
    case 'slightly-fast':
      return {
        summary: 'A touch fast. Breathe a beat longer.',
        roast: `${playerName} keeps trying to speedrun the hive. One calmer breath and it lands.`,
      };
    case 'very-fast':
      return {
        summary: 'Too fast. Wait more before committing.',
        roast: `${playerName} heard an imaginary starting pistol and never recovered. Ease off the turbo.`,
      };
    case 'slightly-slow':
      return {
        summary: 'A touch slow. Trust the moment sooner.',
        roast: `${playerName} was almost there, just leaving the cards in dramatic suspense a bit too long.`,
      };
    case 'very-slow':
      return {
        summary: 'Too slow. Commit earlier.',
        roast: `${playerName} was roleplaying a museum curator. These cards are meant to move.`,
      };
    default:
      return {
        summary: 'Not enough timing signal to judge fairly.',
        roast: `${playerName} stayed so mysterious the hive still wants a replay.`,
      };
  }
}

export function calculateFinalResults(input: {
  players: PlayerMeta[];
  plays: RecordedPlay[];
  gameStartedAt: number;
  completedAt: number;
  errorCounts: Record<string, number>;
}): FinalPlayerResult[] {
  const manualPlays = input.plays.filter((play) => play.source === 'manual').sort((a, b) => a.ts - b.ts);
  const matchStart = input.gameStartedAt;
  const matchEnd = Math.max(input.completedAt, matchStart + 1);
  const matchDuration = Math.max(1, matchEnd - matchStart);

  const playsByPlayer = new Map<string, RecordedPlay[]>();
  input.players.forEach((player) => playsByPlayer.set(player.id, []));
  manualPlays.forEach((play) => playsByPlayer.get(play.playerId)?.push(play));

  const fractionsByPlayer = new Map<string, number[]>();
  playsByPlayer.forEach((plays, playerId) => {
    fractionsByPlayer.set(
      playerId,
      plays.map((play) => (play.ts - matchStart) / matchDuration),
    );
  });

  const results = input.players.map<FinalPlayerResult>((player) => {
    if (player.isCpu) {
      const messages = buildMessages(player.name, 'sync');
      return {
        playerId: player.id,
        playerName: player.name,
        score: 100,
        timingBand: 'sync',
        direction: 'steady',
        avgDeviationMs: 0,
        errorPenalty: 0,
        errorCount: 0,
        summary: messages.summary,
        roast: `${player.name} is a cold-blooded metronome. Of course the robot nailed it.`,
      };
    }

    const playerPlays = playsByPlayer.get(player.id) ?? [];
    const deviationsMs = playerPlays.map((play, index) => {
      const others = expectedFractionsFromOthers(player.id, fractionsByPlayer, index);
      if (others.length === 0) return 0;
      const expectedFraction = others.reduce((sum, value) => sum + value, 0) / others.length;
      const actualFraction = (play.ts - matchStart) / matchDuration;
      return (actualFraction - expectedFraction) * matchDuration;
    });

    const avgDeviationMs = deviationsMs.length > 0 ? deviationsMs.reduce((sum, value) => sum + value, 0) / deviationsMs.length : 0;
    const avgAbsDeviationMs = deviationsMs.length > 0 ? deviationsMs.reduce((sum, value) => sum + Math.abs(value), 0) / deviationsMs.length : 0;
    const errorCount = input.errorCounts[player.id] ?? 0;
    const errorPenalty = Math.min(MAX_ERROR_PENALTY, errorCount * ERROR_PENALTY_PER_ERROR);

    if (playerPlays.length === 0) {
      const score = clampScore(72 - errorPenalty);
      const messages = buildMessages(player.name, 'unrated');
      return {
        playerId: player.id,
        playerName: player.name,
        score,
        timingBand: 'unrated',
        direction: 'unknown',
        avgDeviationMs: 0,
        errorPenalty,
        errorCount,
        summary: messages.summary,
        roast: messages.roast,
      };
    }

    let score = 100;
    if (avgAbsDeviationMs > PERFECT_WINDOW_MS) score -= ((avgAbsDeviationMs - PERFECT_WINDOW_MS) / HEAVY_DEVIATION_MS) * 42;
    score -= errorPenalty;

    const classified = classifyDeviation(avgDeviationMs);
    const messages = buildMessages(player.name, classified.band);

    return {
      playerId: player.id,
      playerName: player.name,
      score: clampScore(score),
      timingBand: classified.band,
      direction: classified.direction,
      avgDeviationMs: Math.round(avgDeviationMs),
      errorPenalty,
      errorCount,
      summary: messages.summary,
      roast: messages.roast,
    };
  });

  return results.sort((a, b) => b.score - a.score || a.avgDeviationMs - b.avgDeviationMs || a.playerName.localeCompare(b.playerName));
}
