import type { ReactNode } from 'react';

type GameScreenProps = {
  isPlaying: boolean;
  stage: ReactNode;
  commandDeck: ReactNode;
  children: ReactNode;
};

// Game presentation retains its coupled animation state in App during this initial feature boundary.
export function GameScreen({ isPlaying, stage, commandDeck, children }: GameScreenProps) {
  return (
    <section className="game-layout">
      <section className="game-shell">
        <section className={`felt-stage${isPlaying ? ' is-playing' : ''}`}>{stage}</section>
        {commandDeck}
      </section>
      {children}
    </section>
  );
}
