import { useEffect, useMemo, useRef, useState } from 'react';
// useLayoutEffect alias — avoids SSR warnings while being semantically clear
import { io, Socket } from 'socket.io-client';

type Player = {
  id: string;
  name: string;
  connected: boolean;
  ready: boolean;
  handCount?: number;
};

type GamePhase = 'focus' | 'playing' | 'paused' | 'level-complete' | 'game-over' | 'victory';

type RoomState = {
  code: string;
  hostId: string;
  status: 'lobby' | 'in-game';
  players: Player[];
  logs?: GameLogEvent[];
  game: {
    phase: GamePhase;
    currentLevel: number;
    maxLevel: number;
    lives: number;
    stars: number;
    pile: number[];
    pileHistory: PileCard[];
    lastPlayed: number | null;
    starProposal: { initiatorId: string; acceptedBy: string[] } | null;
  } | null;
};

type PileCard = {
  value: number;
  playerId: string;
};

type LevelReward = 'life' | 'star' | null;

type EventOverlay = {
  title: string;
  message: string;
  tone: 'info' | 'good' | 'warn' | 'error';
  detail?: string;
  reward?: LevelReward;
  durationMs?: number;
  errorData?: {
    playedCard: { value: number; playerId: string; playerName: string };
    blockingCards: Array<{ value: number; playerId: string; playerName: string }>;
  };
};

type GameLogType =
  | 'room:joined'
  | 'room:left'
  | 'room:host-changed'
  | 'room:reconnected'
  | 'game:started'
  | 'game:card-played'
  | 'game:error'
  | 'game:discard'
  | 'game:paused'
  | 'game:star-proposed'
  | 'game:star-accepted'
  | 'game:star-used'
  | 'game:level-complete'
  | 'game:reward'
  | 'game:next-level-ready'
  | 'game:restarted'
  | 'game:victory'
  | 'game:over'
  | 'system:connection';

type GameLogEvent = {
  id: string;
  ts: number;
  roomCode: string;
  type: GameLogType;
  payload: Record<string, any>;
};

type LogSegment = {
  text: string;
  playerId?: string;
};

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ??
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001');

const STORAGE_KEYS = {
  playerId: 'th:playerId',
  playerName: 'th:playerName',
  lastRoomCode: 'th:lastRoomCode',
};

const PLAYER_PALETTE = ['#2EEBFF', '#FF2FAE', '#FFCC00', '#FFFFFF'] as const;

const REWARDS: Record<number, 'life' | 'star'> = {
  2: 'star',
  3: 'life',
  5: 'star',
  6: 'life',
  8: 'star',
  9: 'life',
};

const MSG = {
  focus: ['Breathe… and trust the rhythm.', 'Mental silence. Magic begins.', 'No rush. No pause.'],
  playing: [
    'Your lowest card is calling.',
    'Is it time? Play with calm.',
    'Lowest first. Always.',
    'Feel the team\'s tempo.',
  ],
  waiting: ['Hold on… the team is syncing.', 'Waiting for the perfect signal.', 'Patience: every second counts.'],
  paused: ['Tactical pause. Refocus.', 'Timeout. Back to the rhythm.', 'Reconcentration in progress.'],
  starUsed: ['Total consensus. Star activated!', 'Ninja mode: minimum cards out.', 'Perfect team. Clean move.'],
  levelComplete: ['Level cleared, machine!', 'Excellent team sync.', 'Fine rhythm, level done.'],
  victory: ['CONNECTED MINDS! 🏆', 'Flawless victory. What a team!', 'Master level unlocked.'],
  defeat: ['Not today. Stronger tomorrow.', 'We fell together, we learned together.', 'Defeat… but with style.'],
};

function buildPlayerColorMap(players: Player[]): Map<string, string> {
  const map = new Map<string, string>();
  [...players]
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((player, index) => {
      map.set(player.id, PLAYER_PALETTE[index % PLAYER_PALETTE.length]);
    });
  return map;
}

function pickMessage(messages: string[], seed: number): string {
  if (!messages.length) return '';
  return messages[Math.abs(seed) % messages.length];
}

function getOrCreateStablePlayerId(): string {
  const existing = localStorage.getItem(STORAGE_KEYS.playerId);
  if (existing) return existing;

  const created =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;

  localStorage.setItem(STORAGE_KEYS.playerId, created);
  return created;
}

function getRoomCodeFromUrl(): string {
  if (typeof window === 'undefined') return '';
  const code = new URLSearchParams(window.location.search).get('room') ?? '';
  return code.trim().toUpperCase();
}

function buildShareUrl(roomCode: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.searchParams.set('room', roomCode);
  return url.toString();
}

function rewardLabel(level: number): string {
  const reward = REWARDS[level];
  if (!reward) return '—';
  return reward === 'life' ? '+1 Life ❤️' : '+1 Star ⭐';
}

type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

function statusIconForSeat(player: Player, gamePhase?: GamePhase): string {
  if (!player.connected) return 'signal_wifi_off';
  if (gamePhase === 'playing') return 'style';
  if (player.ready) return 'task_alt';
  return 'hourglass_top';
}

function connectionLabel(state: ConnectionState): string {
  return (
    {
      connected: 'Connected',
      reconnecting: 'Reconnecting',
      disconnected: 'Disconnected',
    }[state] ?? state
  );
}

function pileStyle(index: number, value: number) {
  const seed = (value * 9301 + 49297) % 233280;
  const rnd = seed / 233280;
  const x = Math.round((rnd - 0.5) * 42);
  const y = Math.round((((seed * 31) % 233280) / 233280 - 0.5) * 28);
  const rot = Math.round(((((seed * 17) % 233280) / 233280) - 0.5) * 16);

  return {
    '--x': `${x}px`,
    '--y': `${y}px`,
    '--rot': `${rot}deg`,
    '--z': `${index + 1}`,
  } as any;
}

function logIcon(type: GameLogType): string {
  switch (type) {
    case 'room:joined':
      return 'person_add';
    case 'room:left':
      return 'person_remove';
    case 'room:host-changed':
      return 'crown';
    case 'room:reconnected':
      return 'wifi';
    case 'game:started':
      return 'play_arrow';
    case 'game:card-played':
      return 'style';
    case 'game:error':
      return 'warning';
    case 'game:discard':
      return 'delete';
    case 'game:paused':
      return 'pause_circle';
    case 'game:star-proposed':
      return 'star';
    case 'game:star-accepted':
      return 'handshake';
    case 'game:star-used':
      return 'auto_awesome';
    case 'game:level-complete':
      return 'task_alt';
    case 'game:reward':
      return 'workspace_premium';
    case 'game:next-level-ready':
      return 'play_lesson';
    case 'game:restarted':
      return 'replay';
    case 'game:victory':
      return 'emoji_events';
    case 'game:over':
      return 'skull';
    default:
      return 'notes';
  }
}

function logSegments(entry: GameLogEvent): LogSegment[] {
  const p = entry.payload ?? {};
  switch (entry.type) {
    case 'room:joined':
      return [{ text: p.playerName ?? 'Player', playerId: p.playerId }, { text: ' joined the room' }];
    case 'room:left':
      return [
        { text: p.playerName ?? 'Player', playerId: p.playerId },
        { text: p.reason === 'disconnect' ? ' disconnected from the room' : ' left the room' },
      ];
    case 'room:host-changed':
      return [{ text: p.toPlayerName ?? 'Player', playerId: p.toPlayerId }, { text: ' is now host' }];
    case 'room:reconnected':
      return [{ text: p.playerName ?? 'Player', playerId: p.playerId }, { text: ' reconnected to the room' }];
    case 'game:started':
      return [{ text: 'Game started' }];
    case 'game:card-played':
      return [
        { text: p.playerName ?? 'Player', playerId: p.playerId },
        { text: ' played ' },
        { text: String(p.card ?? '?'), playerId: p.playerId },
      ];
    case 'game:error': {
      const played = p.playedCard;
      const blocking: Array<{ value: number; playerId: string }> = p.blockingCards ?? [];
      const segments: LogSegment[] = [
        { text: 'Error: ' },
        { text: String(played?.value ?? '?'), playerId: played?.playerId },
        { text: ' > ' },
      ];
      blocking.forEach((card, index) => {
        segments.push({ text: String(card.value), playerId: card.playerId });
        if (index < blocking.length - 1) segments.push({ text: ', ' });
      });
      return segments;
    }
    case 'game:discard':
      return [
        { text: 'Discard ' },
        { text: String(p.card ?? '?'), playerId: p.playerId },
        { text: ' from ' },
        { text: p.playerName ?? 'Player', playerId: p.playerId },
      ];
    case 'game:paused':
      return [{ text: p.byPlayerName ?? 'A player', playerId: p.byPlayerId }, { text: ' requested pause' }];
    case 'game:star-proposed':
      return [{ text: p.byPlayerName ?? 'A player', playerId: p.byPlayerId }, { text: ' proposed using a star' }];
    case 'game:star-accepted':
      return [{ text: p.byPlayerName ?? 'A player', playerId: p.byPlayerId }, { text: ' accepted using a star' }];
    case 'game:star-used':
      return [{ text: 'Star used automatically' }];
    case 'game:level-complete':
      return [{ text: `Level ${p.levelCompleted ?? '?'} cleared` }];
    case 'game:reward':
      return [{ text: `Reward earned: ${p.reward === 'life' ? 'life' : p.reward === 'star' ? 'star' : '—'}` }];
    case 'game:next-level-ready':
      return [{ text: `Round ${p.level ?? '?'} ready` }];
    case 'game:restarted':
      return [{ text: p.byPlayerName ?? 'The host' }, { text: ' restarted the game' }];
    case 'game:victory':
      return [{ text: 'Game complete: team victory' }];
    case 'game:over':
      return [{ text: `Game over: ${p.reason ?? 'defeat'}` }];
    default:
      return [{ text: 'Game event' }];
  }
}

const RULES = [
  {
    icon: 'hub',
    title: 'The Goal',
    body: 'Play all 100 cards in ascending order as a team — in complete silence. No talking, no signals, no gestures. Only shared instinct.',
  },
  {
    icon: 'style',
    title: 'How to Play',
    body: 'Each round you hold cards. When the timing feels right, play your lowest. If someone plays out of order, the team loses a life and all lower cards are discarded automatically.',
  },
  {
    icon: 'task_alt',
    title: 'Ready & Pause',
    body: 'Before each round starts, every player must press Ready. Any player can call a Pause mid-game — the round resumes only when everyone marks Ready again.',
  },
  {
    icon: 'auto_awesome',
    title: 'Lives, Stars & Rewards',
    body: 'Stars let the whole team discard their lowest card simultaneously. Clearing certain levels earns extra lives or stars as a reward.',
  },
];

function RulesPanels() {
  const [activeIndex, setActiveIndex] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const pausedUntilRef = useRef(0);

  const scrollTo = (i: number) => {
    carouselRef.current?.scrollTo({ left: i * (carouselRef.current.clientWidth || 1), behavior: 'smooth' });
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (!window.matchMedia('(max-width: 899px)').matches) return;
      if (Date.now() < pausedUntilRef.current) return;
      setActiveIndex(prev => {
        const next = (prev + 1) % RULES.length;
        scrollTo(next);
        return next;
      });
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const pauseAutoSwipe = () => { pausedUntilRef.current = Date.now() + 4000; };

  const goTo = (i: number) => {
    pauseAutoSwipe();
    setActiveIndex(i);
    scrollTo(i);
  };

  return (
    <div className="rules-carousel-wrap">
      <section
        className="rules-grid"
        aria-label="How to play"
        ref={carouselRef}
        onScroll={handleScroll}
        onTouchStart={pauseAutoSwipe}
      >
        {RULES.map(({ icon, title, body }) => (
          <div key={title} className="rules-card panel">
            <span className="material-symbols-rounded rules-icon" aria-hidden>{icon}</span>
            <h3 className="rules-title">{title}</h3>
            <p className="rules-body">{body}</p>
          </div>
        ))}
      </section>
      <div className="rules-dots" aria-hidden>
        {RULES.map((_, i) => (
          <button key={i} className={`rules-dot${i === activeIndex ? ' active' : ''}`} onClick={() => goTo(i)} />
        ))}
      </div>
    </div>
  );
}

function HeroTitle() {
  return (
    <h1 className="hero-title">
      <span className="hero-title-the">The</span>
      {' '}
      <span className="hero-title-hive">Hive</span>
    </h1>
  );
}

function HexGrid() {
  const R = 100;
  const colStep = R * 1.5;
  const rowStep = R * Math.sqrt(3);
  const COLS = 9;
  const ROWS = 4;

  const hexPoints = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i;
      return `${+(cx + R * Math.cos(a)).toFixed(1)},${+(cy + R * Math.sin(a)).toFixed(1)}`;
    }).join(' ');

  const vbW = (COLS - 1) * colStep + 2 * R;
  const vbH = (ROWS - 1) * rowStep + rowStep / 2 + R;

  const hexes = Array.from({ length: COLS }, (_, col) => {
    const cx = col * colStep + R;
    const yOff = col % 2 === 1 ? rowStep / 2 : 0;
    return Array.from({ length: ROWS }, (_, row) => ({
      points: hexPoints(cx, row * rowStep + yOff + R * 0.4),
      key: `${col}-${row}`,
    }));
  }).flat();

  return (
    <svg
      className="hero-hex-bg"
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${vbW.toFixed(0)} ${vbH.toFixed(0)}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {hexes.map(({ points, key }) => (
        <polygon key={key} points={points} fill="none" stroke="#b889ff" strokeWidth="1" strokeOpacity="0.22" />
      ))}
    </svg>
  );
}

function AppBackground() {
  return (
    <div className="app-bg" aria-hidden>
      <HexGrid />
      <div className="hero-orb hero-orb-a" />
      <div className="hero-orb hero-orb-b" />
    </div>
  );
}

function HeroSection() {
  return (
    <div className="hero">
      <div className="hero-inner">
        <HeroTitle />
        <p className="hero-tagline">No talking · No signaling · In order</p>
      </div>
    </div>
  );
}

export function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [accessTab, setAccessTab] = useState<'create' | 'join'>('join');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [hand, setHand] = useState<number[]>([]);
  const [error, setError] = useState<string>('');
  const [info, setInfo] = useState<string>('');
  const [eventOverlay, setEventOverlay] = useState<EventOverlay | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEvent[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showAllCards, setShowAllCards] = useState(true);
  const [accessBusy, setAccessBusy] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 'play' | null>(null);
  const [dealtHandCount, setDealtHandCount] = useState(0);
  const [isClearingPile, setIsClearingPile] = useState(false);
  const [lastPlayedToast, setLastPlayedToast] = useState<{ value: number; playerName: string; playerId: string } | null>(null);

  const previousPhaseRef = useRef<GamePhase | null>(null);
  const countdownTimeoutsRef = useRef<number[]>([]);
  const eventOverlayTimeoutRef = useRef<number | null>(null);
  const levelCompleteOverlayTimeoutRef = useRef<number | null>(null);
  const dealIntervalRef = useRef<number | null>(null);
  const previousHandKeyRef = useRef('');
  const previousHandPhaseRef = useRef<GamePhase | null>(null);
  const previousGamePhaseRef = useRef<GamePhase | null>(null);
  const roomRef = useRef<RoomState | null>(null);
  const manualAccessRef = useRef(false);
  const skipNextAutoJoinRef = useRef(false);
  const pendingLevelCompleteRef = useRef<{ levelCompleted: number; reward: LevelReward } | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const logStickToBottomRef = useRef(true);
  const previousLogRoomCodeRef = useRef<string | null>(null);
  const prevPileCountRef = useRef(0);
  const lastPlayedToastTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!room || !info) return;
    const t = window.setTimeout(() => setInfo(''), 3000);
    return () => window.clearTimeout(t);
  }, [room, info]);

  function showEventOverlay(overlay: EventOverlay, ms = 5000) {
    setEventOverlay({ ...overlay, durationMs: ms });
    if (eventOverlayTimeoutRef.current) window.clearTimeout(eventOverlayTimeoutRef.current);
    eventOverlayTimeoutRef.current = window.setTimeout(() => {
      setEventOverlay(null);
    }, ms);
  }

  function pushLog(entry: GameLogEvent) {
    setGameLog((prev) => {
      if (prev.some((item) => item.id === entry.id)) return prev;
      return [...prev, entry].slice(-50);
    });
  }

  function onLogScroll() {
    const el = logScrollRef.current;
    if (!el) return;
    logStickToBottomRef.current = el.scrollTop < 20;
  }

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    if (!showExitConfirm) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showExitConfirm) setShowExitConfirm(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showExitConfirm]);

  useEffect(() => {
    const stableId = getOrCreateStablePlayerId();
    setPlayerId(stableId);

    const savedName = localStorage.getItem(STORAGE_KEYS.playerName) ?? '';
    setPlayerName(savedName);

    const roomFromUrl = getRoomCodeFromUrl();
    const savedRoom = roomFromUrl || localStorage.getItem(STORAGE_KEYS.lastRoomCode) || '';
    if (roomFromUrl) localStorage.setItem(STORAGE_KEYS.lastRoomCode, roomFromUrl);
    setRoomCodeInput(savedRoom);
    if (savedRoom) setAccessTab('join');
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);

    if (room?.code) {
      url.searchParams.set('room', room.code);
    } else {
      url.searchParams.delete('room');
    }

    window.history.replaceState({}, '', url.toString());
  }, [room?.code]);

  useEffect(() => {
    if (!playerName) return;
    localStorage.setItem(STORAGE_KEYS.playerName, playerName);
  }, [playerName]);

  useEffect(() => {
    if (!playerId) return;

    const s = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
    setSocket(s);

    s.on('connect', () => {
      setConnectionState('connected');
      setError('');

      if (manualAccessRef.current) return;
      if (skipNextAutoJoinRef.current) {
        skipNextAutoJoinRef.current = false;
        return;
      }
      if (roomRef.current) return;

      const savedRoom = (localStorage.getItem(STORAGE_KEYS.lastRoomCode) ?? '').trim().toUpperCase();
      const savedName = (localStorage.getItem(STORAGE_KEYS.playerName) ?? '').trim();

      if (!savedRoom || !savedName) return;

      s.emit('room:join', { roomCode: savedRoom, playerName: savedName, playerId }, (response: any) => {
        if (!response?.ok) {
          localStorage.removeItem(STORAGE_KEYS.lastRoomCode);
          setInfo('Could not restore session automatically.');
          return;
        }

        setRoom(response.room);
        setInfo(response.reconnected ? 'Reconnected to room.' : 'Session restored.');
      });
    });

    s.on('disconnect', () => {
      setConnectionState('disconnected');
      setInfo('Connection lost. Retrying...');
    });

    s.on('reconnect_attempt', () => {
      setConnectionState('reconnecting');
    });

    s.on('room:update', (updatedRoom: RoomState) => {
      setRoom(updatedRoom);
      if (Array.isArray(updatedRoom.logs)) {
        setGameLog(updatedRoom.logs.slice(-50));
      }
    });

    s.on('game:log', (entry: GameLogEvent) => {
      pushLog(entry);
    });

    s.on('player:state', (payload: { hand: number[] }) => {
      setHand(payload?.hand ?? []);
    });

    s.on(
      'game:error-penalty',
      (payload: {
        playedCard: { value: number; playerId: string; playerName: string };
        blockingCards: Array<{ value: number; playerId: string; playerName: string }>;
      }) => {
        showEventOverlay(
          {
            title: 'Error',
            message: '❤️ -1',
            tone: 'error',
            errorData: payload,
          },
          5000,
        );
      },
    );

    s.on('game:paused', (payload: { message?: string }) => {
      const msg = payload?.message ?? pickMessage(MSG.paused, Date.now());
      setInfo(msg);
      showEventOverlay({ title: 'Pause', message: msg, tone: 'warn' }, 5000);
    });

    s.on('game:star-used', (payload: { message?: string }) => {
      const msg = payload?.message ?? pickMessage(MSG.starUsed, Date.now());
      setInfo(msg);
      showEventOverlay({ title: 'Star activated', message: msg, tone: 'good' }, 2600);
    });

    s.on('game:level-complete', (payload: { levelCompleted: number; reward: LevelReward }) => {
      pendingLevelCompleteRef.current = payload;
    });

    s.on('game:next-level-ready', () => {
      setInfo('Deal ready.');
    });

    s.on('game:restarted', (payload: { message?: string }) => {
      const msg = payload?.message ?? 'Game restarted in the same room.';
      setInfo(msg);
      showEventOverlay({ title: 'Retry', message: 'Game restarted in the same room.', tone: 'info' }, 5000);
    });

    s.on('game:over', () => {
      setEventOverlay(null);
      const msg = pickMessage(MSG.defeat, Date.now());
      setInfo(msg);
    });

    return () => {
      if (eventOverlayTimeoutRef.current) window.clearTimeout(eventOverlayTimeoutRef.current);
      if (levelCompleteOverlayTimeoutRef.current) window.clearTimeout(levelCompleteOverlayTimeoutRef.current);
      s.disconnect();
    };
  }, [playerId]);

  useEffect(() => {
    const phase = room?.game?.phase ?? null;
    const previous = previousPhaseRef.current;

    countdownTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    countdownTimeoutsRef.current = [];

    if (phase === 'playing' && (previous === 'focus' || previous === 'paused')) {
      setCountdown(3);
      countdownTimeoutsRef.current.push(window.setTimeout(() => setCountdown(2), 900));
      countdownTimeoutsRef.current.push(window.setTimeout(() => setCountdown(1), 1800));
      countdownTimeoutsRef.current.push(window.setTimeout(() => setCountdown('play'), 2700));
      countdownTimeoutsRef.current.push(window.setTimeout(() => setCountdown(null), 3600));
    } else {
      setCountdown(null);
    }

    previousPhaseRef.current = phase;

    return () => {
      countdownTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [room?.game?.phase]);

  useEffect(() => {
    const phase = room?.game?.phase ?? null;
    const prev = previousGamePhaseRef.current;
    const currentPileCount = room?.game?.pileHistory?.length ?? 0;

    if (phase === 'level-complete' && prev !== 'level-complete' && currentPileCount > 0) {
      setIsClearingPile(true);
      const clearAnimationBaseMs = 520;
      const clearStepDelayMs = 48;
      const settleBufferMs = 120;
      const totalClearMs = clearAnimationBaseMs + Math.max(0, currentPileCount - 1) * clearStepDelayMs + settleBufferMs;

      if (levelCompleteOverlayTimeoutRef.current) window.clearTimeout(levelCompleteOverlayTimeoutRef.current);
      levelCompleteOverlayTimeoutRef.current = window.setTimeout(() => {
        const pending = pendingLevelCompleteRef.current;
        if (pending) {
          const msg = pickMessage(MSG.levelComplete, Date.now() + pending.levelCompleted);
          showEventOverlay(
            {
              title: `Level ${pending.levelCompleted} cleared`,
              message: msg,
              tone: 'good',
              reward: pending.reward ?? null,
            },
            3200,
          );
          pendingLevelCompleteRef.current = null;
        }
        setIsClearingPile(false);
      }, totalClearMs);

      previousGamePhaseRef.current = phase;
      return () => {
        if (levelCompleteOverlayTimeoutRef.current) window.clearTimeout(levelCompleteOverlayTimeoutRef.current);
      };
    }

    if (phase === 'focus' || phase === 'playing') {
      setIsClearingPile(false);
      pendingLevelCompleteRef.current = null;
    }

    previousGamePhaseRef.current = phase;
  }, [room?.game?.phase, room?.game?.pileHistory?.length]);

  useEffect(() => {
    const handKey = hand.join(',');
    const phase = room?.game?.phase ?? null;

    if (handKey === previousHandKeyRef.current && phase === previousHandPhaseRef.current) {
      return;
    }
    previousHandKeyRef.current = handKey;
    previousHandPhaseRef.current = phase;

    if (dealIntervalRef.current) {
      window.clearInterval(dealIntervalRef.current);
      dealIntervalRef.current = null;
    }

    if (!hand.length) {
      setDealtHandCount(0);
      return;
    }

    if (phase !== 'focus') {
      setDealtHandCount(hand.length);
      return;
    }

    setDealtHandCount(0);
    let current = 0;
    dealIntervalRef.current = window.setInterval(() => {
      current += 1;
      setDealtHandCount(current);
      if (current >= hand.length && dealIntervalRef.current) {
        window.clearInterval(dealIntervalRef.current);
        dealIntervalRef.current = null;
      }
    }, 460);

    return () => {
      if (dealIntervalRef.current) {
        window.clearInterval(dealIntervalRef.current);
        dealIntervalRef.current = null;
      }
    };
  }, [hand, room?.game?.phase]);

  useEffect(() => {
    const el = logScrollRef.current;
    if (!el) return;
    if (logStickToBottomRef.current) el.scrollTop = 0;
  }, [gameLog]);

  useEffect(() => {
    const code = room?.code ?? null;
    if (previousLogRoomCodeRef.current !== code) {
      setGameLog([]);
      logStickToBottomRef.current = true;
      previousLogRoomCodeRef.current = code;
    }
  }, [room?.code]);

  const me = useMemo(() => room?.players.find((player) => player.id === playerId) ?? null, [room, playerId]);

  const game = room?.game ?? null;
  const pileCards = useMemo<PileCard[]>(() => game?.pileHistory ?? [], [game?.pileHistory]);
  const playerColorMap = useMemo(() => buildPlayerColorMap(room?.players ?? []), [room?.players]);
  const playersList = useMemo(() => room?.players ?? [], [room?.players]);

  useEffect(() => {
    const count = pileCards.length;
    if (count > prevPileCountRef.current && count > 0) {
      const last = pileCards[count - 1];
      const name = playersList.find((p) => p.id === last.playerId)?.name ?? 'Player';
      setLastPlayedToast({ value: last.value, playerName: name, playerId: last.playerId });
      if (lastPlayedToastTimeoutRef.current) window.clearTimeout(lastPlayedToastTimeoutRef.current);
      lastPlayedToastTimeoutRef.current = window.setTimeout(() => setLastPlayedToast(null), 2000);
    }
    prevPileCountRef.current = count;
    return () => {
      if (lastPlayedToastTimeoutRef.current) window.clearTimeout(lastPlayedToastTimeoutRef.current);
    };
  }, [pileCards, playersList]);

  const isHost = room?.hostId === playerId;
  const isPlaying = game?.phase === 'playing';
  const isFocusOrPaused = game?.phase === 'focus' || game?.phase === 'paused';
  const canReadyForRound = !!room && room.status === 'in-game' && isFocusOrPaused;
  const hasStarProposal = !!game?.starProposal;
  const alreadyAcceptedStar = !!game?.starProposal?.acceptedBy.includes(playerId);

  const canStart =
    !!room &&
    room.status === 'lobby' &&
    room.players.length >= 2 &&
    room.players.every((player) => player.connected && player.ready) &&
    isHost;
  const minPlayableCard = hand.length > 0 ? Math.min(...hand) : null;
  const showReady = !me?.ready && (((room?.status === 'lobby') && (room?.players.length ?? 0) >= 2) || canReadyForRound);
  const showNotReady = Boolean(me?.ready) && ((room?.status === 'lobby') || canReadyForRound);
  const showStart = room?.status === 'lobby' && canStart;
  const overlayBlocking = countdown !== null || !!eventOverlay;
  const showPause = isPlaying && !overlayBlocking;
  const showProposeStar = isPlaying && (game?.stars ?? 0) > 0 && !hasStarProposal && !overlayBlocking;
  const showAcceptStar = isPlaying && hasStarProposal && !alreadyAcceptedStar && !overlayBlocking;
  const currentReward = game ? rewardLabel(game.currentLevel) : '—';
  const currentRewardType = game ? REWARDS[game.currentLevel] ?? null : null;
  const dealtCards = useMemo(() => hand.slice(0, dealtHandCount), [hand, dealtHandCount]);
  const orderedDealtCards = useMemo(() => [...dealtCards].sort((a, b) => a - b), [dealtCards]);
  const primaryCard = orderedDealtCards[0] ?? null;
  const secondaryCards = orderedDealtCards.slice(1);
  const hiddenCount = secondaryCards.length;

  function saveRoomCode(roomCode: string) {
    localStorage.setItem(STORAGE_KEYS.lastRoomCode, roomCode);
    setRoomCodeInput(roomCode);
  }

  function clearRoomState() {
    setRoom(null);
    setHand([]);
    setEventOverlay(null);
    setGameLog([]);
    setLastPlayedToast(null);
    prevPileCountRef.current = 0;
  }

  function emitWithAck<T = any>(event: string, payload?: unknown): Promise<T> {
    return new Promise((resolve) => {
      if (!socket) {
        resolve({ ok: false, error: 'No socket connection' } as T);
        return;
      }

      if (typeof payload === 'undefined') {
        socket.emit(event, (response: T) => resolve(response));
        return;
      }

      socket.emit(event, payload, (response: T) => resolve(response));
    });
  }

  async function createRoom() {
    setError('');
    setInfo('');

    if (!socket) return;
    if (!playerName.trim()) {
      setError('Enter your name');
      return;
    }

    manualAccessRef.current = true;
    setAccessBusy(true);

    const response = await emitWithAck<any>('room:create', { playerName, playerId });

    manualAccessRef.current = false;
    setAccessBusy(false);

    if (!response?.ok) {
      setError(response?.error ?? 'Could not create room');
      return;
    }

    setRoom(response.room);
    setHand([]);
    saveRoomCode(response.room.code);
  }

  async function joinRoom() {
    setError('');
    setInfo('');

    if (!socket) return;
    if (!playerName.trim()) {
      setError('Enter your name');
      return;
    }
    if (!roomCodeInput.trim()) {
      setError('Enter room code');
      return;
    }

    manualAccessRef.current = true;
    setAccessBusy(true);

    const response = await emitWithAck<any>('room:join', {
      roomCode: roomCodeInput.trim().toUpperCase(),
      playerName,
      playerId,
    });

    manualAccessRef.current = false;
    setAccessBusy(false);

    if (!response?.ok) {
      setError(response?.error ?? 'Could not join room');
      return;
    }

    setRoom(response.room);
    setHand([]);
    saveRoomCode(response.room.code);
    setInfo(response.reconnected ? 'Reconnected to room' : 'Joined room');
  }

  function setReady(ready: boolean) {
    setError('');
    if (!socket) return;
    socket.emit('player:ready', { ready }, (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not update ready state');
    });
  }

  function startGame() {
    setError('');
    setInfo('');
    if (!socket) return;
    socket.emit('game:start', (response: any) => {
      if (!response?.ok) {
        setError(response?.error ?? 'Could not start game');
        return;
      }
    });
  }

  function playCard(card: number) {
    setError('');
    if (!socket) return;
    socket.emit('game:play-card', { card }, (response: any) => {
      if (!response?.ok) {
        setError(response?.error ?? 'Could not play card');
      }
    });
  }

  function requestPause() {
    setError('');
    if (!socket) return;
    socket.emit('game:pause-request', (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not pause');
    });
  }

  function proposeStar() {
    setError('');
    if (!socket) return;
    socket.emit('star:propose', (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not propose star');
    });
  }

  function acceptStar() {
    setError('');
    if (!socket) return;
    socket.emit('star:accept', (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not accept star');
    });
  }

  function visibleBacksCountForRival(player: Player): number {
    if (typeof player.handCount === 'number') return Math.max(0, player.handCount);
    if (!game) return 0;
    return Math.max(1, Math.min(game.currentLevel, 8));
  }

  function cardsRemainingForPlayer(player: Player): number {
    if (player.id === playerId) return hand.length;
    return visibleBacksCountForRival(player);
  }

  async function leaveRoom(): Promise<boolean> {
    if (!room) {
      clearRoomState();
      return true;
    }

    const response = await emitWithAck<any>('room:leave');
    if (!response?.ok) {
      setError(response?.error ?? 'Could not leave room');
      return false;
    }

    clearRoomState();
    return true;
  }

  async function abandonMatch() {
    localStorage.removeItem(STORAGE_KEYS.lastRoomCode);
    skipNextAutoJoinRef.current = true;
    const ok = await leaveRoom();
    if (!ok) return;
    setInfo('You left the room.');
  }

  function requestAbandonMatch() {
    setShowExitConfirm(true);
  }

  function cancelAbandonMatch() {
    setShowExitConfirm(false);
  }

  async function confirmAbandonMatch() {
    setShowExitConfirm(false);
    await abandonMatch();
  }

  async function retryMatch() {
    if (!socket) return;
    setError('');
    setInfo('');

    const response = await emitWithAck<any>('game:retry');
    if (!response?.ok) {
      setError(response?.error ?? 'Could not restart game');
      return;
    }
  }

  async function copyRoomLink() {
    if (!room?.code) return;
    const shareUrl = buildShareUrl(room.code);

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Ignore copy feedback toast for room link actions.
    }
  }

  return (
    <main className="table-page">
      <AppBackground />
      <header className="topbar">
        <div className="chips">
          {room && <span className={`chip ${connectionState}`}>
            <span className="material-symbols-rounded chip-icon" aria-hidden>
              {connectionState === 'connected'
                ? 'wifi'
                : connectionState === 'reconnecting'
                  ? 'wifi_find'
                  : 'wifi_off'}
            </span>
            <span>Net: {connectionLabel(connectionState)}</span>
          </span>}
          {room && (
            <div className="chip room-chip" aria-label={`Room ${room.code}`}>
              <span>Room: {room.code}</span>
              <button className="room-copy-btn" onClick={copyRoomLink} title="Copy room link" aria-label="Copy room link">
                <span className="material-symbols-rounded" aria-hidden>
                  content_copy
                </span>
              </button>
            </div>
          )}
        </div>
        {room && (
          <button className="topbar-exit" onClick={requestAbandonMatch} title="Leave room" aria-label="Leave room">
            <span className="material-symbols-rounded" aria-hidden>logout</span>
          </button>
        )}
      </header>

      {!room && (
        <div className="lobby-scroll">
        <HeroSection />
        <section className="panel lobby-panel">
          <div className="tabs-row" role="tablist" aria-label="Room access">
            <button
              role="tab"
              aria-selected={accessTab === 'join'}
              className={`tab-btn ${accessTab === 'join' ? 'active' : ''}`}
              onClick={() => setAccessTab('join')}
            >
              Join room
            </button>
            <button
              role="tab"
              aria-selected={accessTab === 'create'}
              className={`tab-btn ${accessTab === 'create' ? 'active' : ''}`}
              onClick={() => setAccessTab('create')}
            >
              Create room
            </button>
          </div>

          {accessTab === 'create' && (
            <div className="lobby-grid">
              <label>
                Name
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your name"
                />
              </label>

              <div className="actions align-right">
                <button onClick={createRoom} disabled={accessBusy}>Create room</button>
              </div>
            </div>
          )}

          {accessTab === 'join' && (
            <div className="lobby-grid">
              <label>
                Name
                <input
                  value={playerName}
                  onChange={(e) => setPlayerName(e.target.value)}
                  placeholder="Your name"
                />
              </label>

              <label>
                Room code
                <input
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                />
              </label>

              <div className="actions align-right">
                <button onClick={joinRoom} disabled={accessBusy}>Join</button>
              </div>
            </div>
          )}
        </section>
        <RulesPanels />
        </div>
      )}

      {room && (
        <section className="game-layout">
          <section className={`table-wrap panel${room?.status === 'in-game' ? ' in-game' : ''}`}>
            <aside className="players-overlay" aria-label="Player status">
              <ul className="players-list">
                {playersList.map((player) => {
                  const cardsRemaining = cardsRemainingForPlayer(player);
                  const isPlayerPlaying = game?.phase === 'playing' && player.connected;

                  return (
                    <li key={player.id} className={`players-item ${isPlayerPlaying ? 'is-playing' : ''}`}>
                      <div className="players-main-row">
                        <span className="players-main-left">
                          <span className="players-status" title={`${player.name}: estado`}>
                            <span className="material-symbols-rounded" aria-hidden>
                              {statusIconForSeat(player, game?.phase)}
                            </span>
                          </span>
                          <strong className="players-name" style={{ color: playerColorMap.get(player.id) }}>
                            {player.name}
                          </strong>
                          {player.id === room.hostId && (
                            <span className="owner-badge material-symbols-rounded" aria-label="Host">
                              crown
                            </span>
                          )}
                        </span>

                        <div className="player-backs" aria-hidden>
                          {Array.from({ length: cardsRemaining }).map((_, i) => (
                            <span key={`${player.id}-back-${i}`} className="player-back" style={{ '--i': i } as any} />
                          ))}
                        </div>
                        <span className="player-count-badge" aria-hidden>×{cardsRemaining}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </aside>

            <div className={`table-felt${isPlaying ? ' is-playing' : ''}`}>
              <div className="table-resources-overlay" aria-label="Team resources">
                <span className="status-item">
                  <strong>
                    <span className="material-symbols-rounded inline-icon" aria-hidden>
                      favorite
                    </span>
                    Lives:
                  </strong>{' '}
                  {game?.lives ?? '—'}
                </span>
                <span className="status-item">
                  <strong>
                    <span className="material-symbols-rounded inline-icon" aria-hidden>
                      star
                    </span>
                    Stars:
                  </strong>{' '}
                  {game?.stars ?? '—'}
                </span>
                <span className="status-item">
                  <strong>
                    <span className="material-symbols-rounded inline-icon" aria-hidden>
                      floor
                    </span>
                    Level:
                  </strong>{' '}
                  {game ? `${game.currentLevel}/${game.maxLevel}` : '—'}
                </span>
              </div>

              <div className="table-progress-overlay" aria-label="Round reward">
                <span className="status-item status-reward">
                  <strong>
                    <span className="material-symbols-rounded inline-icon reward-label-icon" aria-hidden>
                      workspace_premium
                    </span>
                    Reward:
                  </strong>
                  {currentRewardType === 'life' && (
                    <span className="material-symbols-rounded inline-icon reward-type-icon reward-life-icon" aria-hidden title="Life">
                      favorite
                    </span>
                  )}
                  {currentRewardType === 'star' && (
                    <span className="material-symbols-rounded inline-icon reward-type-icon reward-star-icon" aria-hidden title="Star">
                      star
                    </span>
                  )}
                  {!currentRewardType && ` ${currentReward}`}
                </span>
              </div>

              <div className={`center-pile ${isClearingPile ? 'clearing' : ''}`} aria-label="center pile">
                {pileCards.length === 0 && <div className="pile-empty">Play the first card</div>}

                {pileCards.map((card, index) => (
                  <article
                    key={`${card.value}-${index}`}
                    className="card face pile"
                    style={{
                      ...pileStyle(index, card.value),
                      '--clear-delay': `${index * 48}ms`,
                      borderColor: playerColorMap.get(card.playerId) ?? undefined,
                    } as any}
                  >
                    <span className="corner tl">{card.value}</span>
                    <span className="center">{card.value}</span>
                    <span className="corner br">{card.value}</span>
                  </article>
                ))}
              </div>

              {lastPlayedToast && !countdown && !eventOverlay && (
                <div className="last-played-toast" aria-live="polite">
                  <span style={{ color: playerColorMap.get(lastPlayedToast.playerId) }}>
                    {lastPlayedToast.playerName}
                  </span>
                  {' played '}
                  <strong style={{ color: playerColorMap.get(lastPlayedToast.playerId) }}>
                    {lastPlayedToast.value}
                  </strong>
                </div>
              )}

              {countdown && (
                <div className="countdown-overlay">
                  <div className={`count-number ${countdown === 'play' ? 'play' : ''}`}>
                    {countdown === 'play' ? 'PLAY!' : countdown}
                  </div>
                </div>
              )}

              {eventOverlay && game?.phase !== 'victory' && game?.phase !== 'game-over' && (
                <div className="event-overlay-backdrop">
                  <div className={`event-overlay-card ${eventOverlay.tone}`}>
                    <h2>{eventOverlay.title}</h2>
                    <p>{eventOverlay.message}</p>
                    {eventOverlay.tone === 'error' && eventOverlay.errorData && (
                      <p className="error-compact-line">
                        <span
                          className="error-number"
                          style={{ color: playerColorMap.get(eventOverlay.errorData.playedCard.playerId) }}
                        >
                          {eventOverlay.errorData.playedCard.value}
                        </span>{' '}
                        {'>'}{' '}
                        {(eventOverlay.errorData.blockingCards ?? []).map((card, idx) => (
                          <span key={`${card.playerId}-${card.value}-${idx}`}>
                            <span className="error-number" style={{ color: playerColorMap.get(card.playerId) }}>
                              {card.value}
                            </span>
                            {idx < ((eventOverlay.errorData?.blockingCards.length ?? 0) - 1) ? ', ' : ''}
                          </span>
                        ))}
                      </p>
                    )}
                    {eventOverlay.detail && <small>{eventOverlay.detail}</small>}
                    {eventOverlay.reward && (
                      <div className="reward-big">
                        {eventOverlay.reward === 'life' ? (
                          <span title="+1 vida">
                            <span className="material-symbols-rounded inline-icon" aria-hidden>
                              favorite
                            </span>{' '}
                            +1
                          </span>
                        ) : (
                          <span title="+1 estrella">
                            <span className="material-symbols-rounded inline-icon" aria-hidden>
                              star
                            </span>{' '}
                            +1
                          </span>
                        )}
                      </div>
                    )}
                    <div className="overlay-progress-track" aria-hidden>
                      <div
                        className="overlay-progress-fill"
                        style={{ '--overlay-ms': `${eventOverlay.durationMs ?? 5000}ms` } as any}
                      />
                    </div>
                  </div>
                </div>
              )}

              {showExitConfirm && (
                <div className="modal-backdrop">
                  <div className="modal-card exit-modal">
                    <h3>Leave room</h3>
                    <p>Are you sure you want to leave? You'll lose the current game in this room.</p>
                    <div className="actions centered">
                      <button className="btn-secondary" onClick={cancelAbandonMatch}>
                        Cancel
                      </button>
                      <button className="btn-danger" onClick={() => void confirmAbandonMatch()}>
                        Yes, leave
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {game?.phase === 'victory' && (
                <div className="result-overlay victory">
                  <div className="confetti-layer" aria-hidden>
                    {Array.from({ length: 24 }).map((_, i) => (
                      <span key={`c-${i}`} className="confetti" style={{ '--i': i } as any} />
                    ))}
                  </div>
                  <h2>YOU WON!</h2>
                  <p>{pickMessage(MSG.victory, game.currentLevel + game.pile.length)}</p>
                  <div className="actions centered">
                    {isHost ? (
                      <button onClick={retryMatch}>Retry</button>
                    ) : (
                      <span className="muted">Waiting for host to retry…</span>
                    )}
                    <button onClick={requestAbandonMatch}>Abandon</button>
                  </div>
                </div>
              )}

              {game?.phase === 'game-over' && (
                <div className="result-overlay defeat">
                  <h2>
                    <span className="material-symbols-rounded inline-icon" aria-hidden>
                      skull
                    </span>{' '}
                    You lost
                  </h2>
                  <div className="actions centered">
                    {isHost ? (
                      <button onClick={retryMatch}>Retry</button>
                    ) : (
                      <span className="muted">Waiting for host to retry…</span>
                    )}
                    <button onClick={requestAbandonMatch}>Abandon</button>
                  </div>
                </div>
              )}
            </div>

            <section className="game-log-row panel" aria-label="Game log">
              <header className="game-log-header">
                <strong>Game log</strong>
              </header>

              <div className="game-log-list" ref={logScrollRef} onScroll={onLogScroll}>
                {gameLog.length === 0 && <p className="log-empty">No events yet.</p>}
                {[...gameLog].reverse().map((entry) => (
                  <article key={entry.id} className="log-item log-item-enter">
                    <span className="material-symbols-rounded log-icon" aria-hidden>
                      {logIcon(entry.type)}
                    </span>
                    <p className="log-message">
                      {logSegments(entry).map((segment, index) => (
                        <span
                          key={`${entry.id}-seg-${index}`}
                          style={{ color: segment.playerId ? playerColorMap.get(segment.playerId) : undefined }}
                        >
                          {segment.text}
                        </span>
                      ))}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <div className="my-hand panel">
              <div className="hand-layout">
                {!orderedDealtCards.length && <p className="muted">No cards in hand</p>}

                {primaryCard !== null && (
                  <button
                    className={`card face hand-card${isPlaying && !overlayBlocking && primaryCard === minPlayableCard ? ' playable' : ''}`}
                    onClick={() => playCard(primaryCard)}
                    disabled={!isPlaying || overlayBlocking || primaryCard !== minPlayableCard}
                    title="Play this card"
                    style={{ borderColor: playerColorMap.get(playerId) ?? undefined } as any}
                  >
                    <span className="corner tl">{primaryCard}</span>
                    <span className="center">{primaryCard}</span>
                    <span className="corner br">{primaryCard}</span>
                  </button>
                )}

                {!showAllCards && hiddenCount > 0 && (
                  <button
                    className="card face hand-card hand-more-toggle"
                    onClick={() => setShowAllCards(true)}
                    title="Show other cards"
                  >
                    <span className="center">+{hiddenCount}</span>
                  </button>
                )}

                {showAllCards && secondaryCards.map((card, i) => (
                  <button
                    key={`secondary-${card}`}
                    className={`card face hand-card${isPlaying && !overlayBlocking && card === minPlayableCard ? ' playable' : ''}`}
                    onClick={() => { playCard(card); setShowAllCards(false); }}
                    disabled={!isPlaying || overlayBlocking || card !== minPlayableCard}
                    title="Waiting card"
                    style={{ borderColor: playerColorMap.get(playerId) ?? undefined, '--i': i } as any}
                  >
                    <span className="corner tl">{card}</span>
                    <span className="center">{card}</span>
                    <span className="corner br">{card}</span>
                  </button>
                ))}
              </div>
            </div>

            {(showReady || showNotReady || showStart || showPause || showProposeStar || showAcceptStar) && (
              <div className="mobile-cta-bar">
                {showReady && (
                  <button className="mobile-cta-btn pulse" onClick={() => setReady(true)} disabled={overlayBlocking}>
                    <span className="material-symbols-rounded" aria-hidden>task_alt</span>
                    Ready
                  </button>
                )}
                {showNotReady && (
                  <button className="mobile-cta-btn secondary" onClick={() => setReady(false)} disabled={overlayBlocking}>
                    <span className="material-symbols-rounded" aria-hidden>hourglass_top</span>
                    Waiting…
                  </button>
                )}
                {showStart && (
                  <button className="mobile-cta-btn" onClick={startGame} disabled={overlayBlocking}>
                    <span className="material-symbols-rounded" aria-hidden>play_arrow</span>
                    Start
                  </button>
                )}
                {showPause && (
                  <button className="mobile-cta-btn secondary" onClick={requestPause}>
                    <span className="material-symbols-rounded" aria-hidden>pause</span>
                    Pause
                  </button>
                )}
                {showProposeStar && (
                  <button className="mobile-cta-btn star" onClick={proposeStar}>
                    <span className="material-symbols-rounded" aria-hidden>star</span>
                    Star
                  </button>
                )}
                {showAcceptStar && (
                  <button className="mobile-cta-btn pulse" onClick={acceptStar}>
                    <span className="material-symbols-rounded" aria-hidden>handshake</span>
                    Accept Star
                  </button>
                )}
              </div>
            )}
          </section>
        </section>
      )}

    </main>
  );
}
