import type { PublicRoomState } from '@the-hive/contracts';
import { podiumToneForRank, shouldUseTwoColumnFinalScoreLayout, timingFeedbackForBand } from '../../finalScoreUi.js';
import { DEFEAT_SUBTITLE, VICTORY_SUBTITLE } from '../../messageTiming.js';

type ResultsOverlayProps = { room: PublicRoomState; playerId: string; onRetry: () => void; onRequestLeave: () => void };

export function ResultsOverlay({ room, playerId, onRetry, onRequestLeave }: ResultsOverlayProps) {
  const game = room.game;
  if (!game || (game.phase !== 'victory' && game.phase !== 'game-over')) return null;
  const victory = game.phase === 'victory';
  const results = game.finalResults ?? [];
  const isHost = room.hostId === playerId;
  return <div className={`result-overlay ${victory ? 'victory' : 'defeat'}`}>{victory && <div className="confetti-layer" aria-hidden>{Array.from({ length: 24 }).map((_, index) => <span key={`c-${index}`} className="confetti" style={{ '--i': index } as React.CSSProperties} />)}</div>}<h2>{victory ? 'YOU WON' : <><span className="material-symbols-rounded inline-icon" aria-hidden>skull</span>{' '}YOU LOST</>}</h2><p className="event-message-detail result-subtitle">{victory ? VICTORY_SUBTITLE : DEFEAT_SUBTITLE}</p>{results.length > 0 && <div className={`final-scoreboard${shouldUseTwoColumnFinalScoreLayout(results.length) ? ' two-columns' : ''}`} aria-label="Final synchronization ranking">{results.map((result, index) => { const tone = podiumToneForRank(index); return <article key={result.playerId} className={`final-score-row podium-${tone}${result.playerId === playerId ? ' is-me' : ''}`}>{tone !== 'none' && <span className={`final-score-crown-ribbon podium-${tone}`} aria-label={`${tone} podium`}><span className="material-symbols-rounded" aria-hidden>crown</span></span>}<div className="final-score-rank">#{index + 1}</div><div className="final-score-copy"><div className="final-score-head"><strong>{result.playerName}</strong><span className={`final-score-band band-${timingFeedbackForBand(result.timingBand).toLowerCase()}`}>{timingFeedbackForBand(result.timingBand)}</span></div></div><div className="final-score-value"><strong>{result.score}</strong></div></article>; })}</div>}<div className="actions centered">{isHost ? <button onClick={onRetry}>Retry</button> : <span className="muted">Waiting for the host to retry.</span>}<button onClick={onRequestLeave}>Leave room</button></div></div>;
}
