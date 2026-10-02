import { useRef, useState } from 'react';

const rules = [
  { icon: 'hub', title: 'The Goal', body: 'Play all 100 cards in ascending order as a team - in complete silence. No talking, no signals, no gestures. Only shared instinct.' },
  { icon: 'style', title: 'Play Your Lowest', body: 'Each round you hold cards. When the timing feels right, play your lowest. If someone plays out of order, the team loses a life and all lower cards are discarded automatically.' },
  { icon: 'task_alt', title: 'Ready & Pause', body: 'Before each round starts, every player with cards must press Ready. Any player can call a Pause mid-game - the round resumes only when the players who still hold cards mark Ready again.' },
  { icon: 'auto_awesome', title: 'Lives, Stars & Rewards', body: 'Stars let the whole team discard their lowest card simultaneously. Clearing certain levels earns extra lives or stars as a reward.' },
];

export function RulesPanels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const goTo = (index: number) => {
    setActiveIndex(index);
    carouselRef.current?.scrollTo({ left: index * (carouselRef.current.clientWidth || 1), behavior: 'smooth' });
  };
  return <div className="rules-carousel-wrap"><h2 className="hero-tagline rules-shell-title">How to play</h2><section className="rules-grid" aria-label="How to play" ref={carouselRef} onScroll={() => { const element = carouselRef.current; if (element) setActiveIndex(Math.round(element.scrollLeft / element.clientWidth)); }}>{rules.map(({ icon, title, body }) => <div key={title} className="rules-card panel"><div className="rules-head"><span className="material-symbols-rounded rules-icon" aria-hidden>{icon}</span><h3 className="rules-title">{title}</h3></div><p className="rules-body">{body}</p></div>)}</section><div className="rules-dots" aria-hidden>{rules.map((_, index) => <button key={index} className={`rules-dot${index === activeIndex ? ' active' : ''}`} onClick={() => goTo(index)} />)}</div></div>;
}
