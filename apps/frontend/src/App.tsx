import { useEffect, useMemo, useRef, useState } from 'react';
// useLayoutEffect alias - avoids SSR warnings while being semantically clear
import { io, Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  FinalPlayerResult,
  InteractionLock,
  PrivateAction,
  PrivatePlayerEnvelope,
  PrivatePlayerState,
  PublicRoomEnvelope,
  PublicRoomState,
  RoomSnapshot,
  ServerToClientEvents,
  StarDiscardPreview,
  GamePhase,
  PileEntry,
  JoinRoomAck,
  ResyncAck,
} from '@the-hive/contracts';
import { deriveConnectionState, RESYNC_INTERVAL_MS, RESYNC_TIMEOUT_MS, type ConnectionState } from './connectionStatus.js';
import {
  countdownValueFromRemaining,
  handDealAnimationMode,
  handDealStateKey,
  isCountdownLockActive,
  isHandDealInProgress,
  isInteractionLockActive,
  lobbyStartDealDelayMs,
} from './gameUi.js';
import {
  applyPrivateFragment,
  applyPrivateSnapshot,
  applyPublicFragment,
  createSnapshotCorrelationState,
  estimateServerClockOffset,
  estimateServerNow,
  shouldApplyDecorativeEvent,
} from './roomSync.js';
import {
  findMyStarDiscard,
  getStarProposalButtons,
  starDiscardLaunchDelayMs,
} from './starUi.js';
import { buildHandLayout, buildHandSlotPath, type HandSlotId } from './handLayout.js';
import { podiumToneForRank, shouldUseTwoColumnFinalScoreLayout, timingFeedbackForBand } from './finalScoreUi.js';
import { levelCompleteOverlayDelayMs } from './levelFlow.js';
import { buildLobbySeats, shouldShowTopbarRoomCode, waitingRoomMessage } from './lobbyUi.js';
import { buildCommandActions } from './commandActions.js';
import logoUrl from '../the-hive-logo.png';
import {
  DEFEAT_SUBTITLE,
  INFO_MESSAGE_DURATION_MS,
  VICTORY_SUBTITLE,
  overlayDurationMs,
  overlaySubtitle,
  readyOverlayBlockedReason,
} from './messageTiming.js';

type Player = PublicRoomState['players'][number];
type RoomState = PublicRoomState;
type AvailableAction = PrivateAction;
type ActionType = PrivateAction['type'];
type PileCard = PileEntry;

type LevelReward = 'life' | 'star' | null;

type EventOverlay = {
  kind?: 'error' | 'pause' | 'star-used' | 'level-complete' | 'restarted';
  title: string;
  message: string;
  tone: 'info' | 'good' | 'warn' | 'error';
  reward?: LevelReward;
  durationMs?: number;
  starDiscards?: StarDiscardPreview[];
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

type StarUsedPayload = {
  message?: string;
  discarded?: StarDiscardPreview[];
};

declare global {
  interface Window {
    __ENV?: Record<string, string> | undefined;
  }
}

const SOCKET_URL =
  // runtime override injected by the container (env-config.js)
  (typeof window !== 'undefined' ? window.__ENV?.VITE_SOCKET_URL : undefined) ||
  // build-time Vite variable
  (import.meta.env.VITE_SOCKET_URL ??
    // fallback to current origin
    (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001'));

const STORAGE_KEYS = {
  playerId: 'th:playerId',
  playerName: 'th:playerName',
  lastRoomCode: 'th:lastRoomCode',
};

const PLAYER_PALETTE = ['#2EEBFF', '#FF2FAE', '#FFCC00', '#FFFFFF', '#9DFF8A', '#FF8A3D', '#B88CFF', '#7CFFCB'] as const;
const RIVAL_POSITIONS = [
  'corner-top-left',
  'corner-top-right',
  'corner-bottom-left',
  'corner-top-center',
  'corner-bottom-center',
  'corner-left-center',
  'corner-right-center',
] as const;
const SELF_POSITION = 'corner-bottom-right' as const;
const MAX_LOBBY_PLAYERS = 8;

const REWARDS: Record<number, 'life' | 'star'> = {
  2: 'star',
  3: 'life',
  5: 'star',
  6: 'life',
  8: 'star',
  9: 'life',
};

const MSG = {
  focus: ['Breathe and trust the rhythm.', 'Silence first. Timing second.', 'The round is waiting for calm.'],
  playing: [
    'Your lowest card is ready.',
    'Read the table and trust the timing.',
    'Lowest first. Always.',
    'Play with the team, not against the clock.',
  ],
  waiting: ['Hold steady. The team is syncing.', 'The next beat is close.', 'Patience is part of the play.'],
  paused: ['Tactical pause. Reset the table.', 'Pause called. Regroup and refocus.', 'Hold for the team.'],
  starUsed: ['Full agreement. Star resolved.', 'Lowest cards cleared together.', 'Clean team move.'],
  levelComplete: ['Level cleared.', 'Strong team timing.', 'The round is yours.'],
  victory: ['Connected minds.', 'Flawless finish.', 'The Hive holds together.'],
  defeat: ['Not this run. Learn the rhythm.', 'The table wins today.', 'Reset and go again.'],
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
  if (!reward) return 'No reward';
  return reward === 'life' ? '+1 Life' : '+1 Star';
}

function rewardTypeLabel(reward: LevelReward): string {
  if (reward === 'life') return '+1 Life';
  if (reward === 'star') return '+1 Star';
  return '';
}

function rewardTypeIcon(reward: LevelReward): string {
  return reward === 'life' ? 'favorite' : 'star';
}

function statusIconForSeat(player: Player, gamePhase?: GamePhase): string {
  if (!player.connected) return 'signal_wifi_off';
  if (gamePhase === 'paused') return 'pause_circle';
  if (gamePhase === 'playing') return 'style';
  if (player.ready) return 'task_alt';
  return 'hourglass_top';
}

function statusLabelForSeat(player: Player, gamePhase?: GamePhase): string {
  if (!player.connected) return 'Offline';
  if (gamePhase === 'paused') return 'Paused';
  if (gamePhase === 'playing') return 'Playing';
  if (player.ready) return 'Ready';
  return 'Waiting';
}
type PileEntryOffset = {
  x: number;
  y: number;
  rot: number;
};

type StarDiscardFlight = {
  card: number;
  startRect: { left: number; top: number; width: number; height: number };
};

type StatusPulse = 'up' | 'down' | null;

function pileEntryOffset(corner: string): PileEntryOffset {
  switch (corner) {
    case 'corner-top-left':
      return { x: -220, y: -170, rot: -18 };
    case 'corner-top-right':
      return { x: 220, y: -170, rot: 18 };
    case 'corner-bottom-left':
      return { x: -220, y: 190, rot: -14 };
    case 'corner-top-center':
      return { x: 0, y: -190, rot: 4 };
    case 'corner-bottom-center':
      return { x: 0, y: 200, rot: -4 };
    case 'corner-left-center':
      return { x: -250, y: 0, rot: -10 };
    case 'corner-right-center':
      return { x: 250, y: 0, rot: 10 };
    case 'corner-bottom-right':
    default:
      return { x: 220, y: 190, rot: 14 };
  }
}

function playerCornerFlipClass(corner: string): string {
  return 'flip-left';
}

function playerCornerNameClass(name: string): string {
  const length = name.trim().length;
  if (length >= 10) return 'player-corner-name compact tiny';
  if (length >= 8) return 'player-corner-name compact';
  return 'player-corner-name';
}

function pileStyle(index: number, value: number, entry: PileEntryOffset) {
  const seed = (value * 9301 + 49297) % 233280;
  const rnd = seed / 233280;
  const x = Math.round((rnd - 0.5) * 24);
  const y = Math.round((((seed * 31) % 233280) / 233280 - 0.5) * 16);
  const rot = Math.round(((((seed * 17) % 233280) / 233280) - 0.5) * 10);

  return {
    '--x': `${x}px`,
    '--y': `${y}px`,
    '--rot': `${rot}deg`,
    '--entry-x': `${entry.x}px`,
    '--entry-y': `${entry.y}px`,
    '--entry-rot': `${entry.rot}deg`,
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
        { text: p.reason === 'star' ? 'Star discard ' : 'Discard ' },
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
      return [{ text: 'Star discarded the lowest cards' }];
    case 'game:level-complete':
      return [{ text: `Level ${p.levelCompleted ?? '?'} cleared` }];
    case 'game:reward':
      return [{ text: `Reward earned: ${p.reward === 'life' ? 'life' : p.reward === 'star' ? 'star' : 'none'}` }];
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
    body: 'Play all 100 cards in ascending order as a team - in complete silence. No talking, no signals, no gestures. Only shared instinct.',
  },
  {
    icon: 'style',
    title: 'Play Your Lowest',
    body: 'Each round you hold cards. When the timing feels right, play your lowest. If someone plays out of order, the team loses a life and all lower cards are discarded automatically.',
  },
  {
    icon: 'task_alt',
    title: 'Ready & Pause',
      body: 'Before each round starts, every player with cards must press Ready. Any player can call a Pause mid-game - the round resumes only when the players who still hold cards mark Ready again.',
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

  const scrollTo = (i: number) => {
    carouselRef.current?.scrollTo({ left: i * (carouselRef.current.clientWidth || 1), behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = carouselRef.current;
    if (!el) return;
    setActiveIndex(Math.round(el.scrollLeft / el.clientWidth));
  };

  const goTo = (i: number) => {
    setActiveIndex(i);
    scrollTo(i);
  };

  return (
    <div className="rules-carousel-wrap">
      <h2 className="hero-tagline rules-shell-title">How to play</h2>
      <section
        className="rules-grid"
        aria-label="How to play"
        ref={carouselRef}
        onScroll={handleScroll}
      >
        {RULES.map(({ icon, title, body }) => (
          <div key={title} className="rules-card panel">
            <div className="rules-head">
              <span className="material-symbols-rounded rules-icon" aria-hidden>{icon}</span>
              <h3 className="rules-title">{title}</h3>
            </div>
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

function MainBrandMark({ heading = false, className = '' }: { heading?: boolean; className?: string }) {
  const brandClassName = `hero-title brand-mark brand-mark-main${className ? ` ${className}` : ''}`;
  const image = <img className="brand-logo-img" src={logoUrl} alt={heading ? 'The Hive' : ''} />;

  if (heading) {
    return <h1 className={brandClassName}>{image}</h1>;
  }

  return (
    <div className={brandClassName} aria-hidden>
      {image}
    </div>
  );
}

function TableBrandMark() {
  return (
    <div className="brand-mark brand-mark-table" aria-hidden>
      <img className="brand-watermark-img brand-watermark-img-top" src={logoUrl} alt="" />
      <img className="brand-watermark-img brand-watermark-img-bottom" src={logoUrl} alt="" />
    </div>
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
        <MainBrandMark heading />
        <p className="hero-tagline">No talking | No signaling | In order</p>
      </div>
    </div>
  );
}

export function App() {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [accessTab, setAccessTab] = useState<'create' | 'join'>('join');
  const [room, setRoom] = useState<RoomState | null>(null);
  const [hand, setHand] = useState<number[]>([]);
  const [availableActions, setAvailableActions] = useState<AvailableAction[]>([]);
  const [error, setError] = useState<string>('');
  const [info, setInfo] = useState<string>('');
  const [eventOverlay, setEventOverlay] = useState<EventOverlay | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEvent[]>([]);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [accessBusy, setAccessBusy] = useState(false);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [countdown, setCountdown] = useState<3 | 2 | 1 | 'play' | null>(null);
  const [dealtHandCount, setDealtHandCount] = useState(0);
  const [isClearingPile, setIsClearingPile] = useState(false);
  const [isPileHidden, setIsPileHidden] = useState(false);
  const [pendingLocalStarDiscardCard, setPendingLocalStarDiscardCard] = useState<number | null>(null);
  const [hiddenStarDiscardCard, setHiddenStarDiscardCard] = useState<number | null>(null);
  const [starDiscardFlight, setStarDiscardFlight] = useState<StarDiscardFlight | null>(null);

  const countdownTimeoutsRef = useRef<number[]>([]);
  const eventOverlayTimeoutRef = useRef<number | null>(null);
  const eventOverlayEndsAtRef = useRef<number | null>(null);
  const levelCompleteOverlayTimeoutRef = useRef<number | null>(null);
  const pileClearStartTimeoutRef = useRef<number | null>(null);
  const starDiscardLaunchTimeoutRef = useRef<number | null>(null);
  const dealStartTimeoutRef = useRef<number | null>(null);
  const dealIntervalRef = useRef<number | null>(null);
  const pendingLobbyDealDelayMsRef = useRef(0);
  const previousHandDealStateKeyRef = useRef('');
  const roomRef = useRef<RoomState | null>(null);
  const playerNameRef = useRef('');
  const manualAccessRef = useRef(false);
  const skipNextAutoJoinRef = useRef(false);
  const reconnectingRef = useRef(false);
  const socketConnectedRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const syncHealthyRef = useRef(false);
  const resyncIntervalRef = useRef<number | null>(null);
  const resyncTimeoutRef = useRef<number | null>(null);
  const logScrollRef = useRef<HTMLDivElement | null>(null);
  const logStickToBottomRef = useRef(true);
  const previousLogRoomCodeRef = useRef<string | null>(null);
  const serverClockOffsetRef = useRef(0);
  const snapshotCorrelationRef = useRef(createSnapshotCorrelationState<RoomState, PrivatePlayerState>());
  const prevPileCountRef = useRef(0);
  const previousResourceRef = useRef<{ lives: number | null; stars: number | null; level: number | null }>({
    lives: null,
    stars: null,
    level: null,
  });
  const resourcePulseTimeoutsRef = useRef<{ lives?: number; stars?: number; level?: number }>({});
  const [resourcePulse, setResourcePulse] = useState<{ lives: StatusPulse; stars: StatusPulse; level: StatusPulse }>({
    lives: null,
    stars: null,
    level: null,
  });
  const centerPileRef = useRef<HTMLDivElement | null>(null);
  const playerCornerRefs = useRef(new Map<string, HTMLElement>());
  const handSlotRefs = useRef(new Map<HandSlotId, HTMLDivElement>());
  const handCardRefs = useRef(new Map<number, HTMLElement>());
  const previousHandSlotMapRef = useRef<Record<number, HandSlotId>>({});
  const pendingLocalPileEntryRef = useRef<{ card: number; entry: PileEntryOffset } | null>(null);
  const starDiscardFlightRef = useRef<HTMLElement | null>(null);
  const [pileEntryMap, setPileEntryMap] = useState<Record<string, PileEntryOffset>>({});

  function setPlayerCornerRef(playerIdForRef: string) {
    return (node: HTMLElement | null) => {
      if (node) {
        playerCornerRefs.current.set(playerIdForRef, node);
        return;
      }
      playerCornerRefs.current.delete(playerIdForRef);
    };
  }

  function setHandSlotRef(slotId: HandSlotId) {
    return (node: HTMLDivElement | null) => {
      if (node) {
        handSlotRefs.current.set(slotId, node);
        return;
      }
      handSlotRefs.current.delete(slotId);
    };
  }

  function setHandCardRef(card: number | null) {
    return (node: HTMLElement | null) => {
      if (card === null) return;
      if (node) {
        handCardRefs.current.set(card, node);
        return;
      }
      handCardRefs.current.delete(card);
    };
  }

  function actionFor(type: ActionType): AvailableAction | undefined {
    return availableActions.find((action) => action.type === type);
  }

  function getEstimatedServerNow(): number {
    return estimateServerNow(serverClockOffsetRef.current);
  }

  function applyClockSample(serverTime: number, clientSentAt?: number) {
    if (typeof clientSentAt !== 'number') return;
    serverClockOffsetRef.current = estimateServerClockOffset({
      clientSentAt,
      clientReceivedAt: Date.now(),
      serverTime,
    });
  }

  function commitAppliedSnapshot(snapshot: RoomSnapshot, opts?: { forceRevealHand?: boolean; clientSentAt?: number }) {
    applyClockSample(snapshot.serverTime, opts?.clientSentAt);
    pendingLobbyDealDelayMsRef.current = lobbyStartDealDelayMs({
      previousRoomStatus: roomRef.current?.status ?? null,
      nextRoomStatus: snapshot.publicState.status,
      nextPhase: snapshot.publicState.game?.phase ?? null,
      forceRevealHand: opts?.forceRevealHand,
    });
    setRoom(snapshot.publicState);
    setHand(snapshot.privateState.hand ?? []);
    setAvailableActions(snapshot.privateState.availableActions ?? []);

    if (opts?.forceRevealHand) {
      if (dealIntervalRef.current) {
        window.clearInterval(dealIntervalRef.current);
        dealIntervalRef.current = null;
      }

      setDealtHandCount(snapshot.privateState.hand.length);
      previousHandDealStateKeyRef.current = handDealStateKey({
        handKey: snapshot.privateState.hand.join(','),
        roomStatus: snapshot.publicState.status,
        phase: snapshot.publicState.game?.phase ?? null,
      });
    }

    syncHealthyRef.current = true;
    syncInFlightRef.current = false;
    clearResyncTimeout();
    refreshConnectionState(socketConnectedRef.current, Boolean(snapshot.publicState ?? roomRef.current));
    return true;
  }

  function applyAuthoritativeSnapshot(snapshot: RoomSnapshot, opts?: { forceRevealHand?: boolean; clientSentAt?: number }) {
    const result = applyPrivateSnapshot(snapshotCorrelationRef.current, snapshot);
    snapshotCorrelationRef.current = result.state;
    if (!result.applied) return false;

    return commitAppliedSnapshot(result.applied, opts);
  }

  function applyCorrelatedSnapshot(snapshot: RoomSnapshot) {
    return commitAppliedSnapshot(snapshot);
  }

  function applyPublicStateFragment(fragment: { version: number; serverTime: number; publicState: RoomState }) {
    const result = applyPublicFragment(snapshotCorrelationRef.current, fragment);
    snapshotCorrelationRef.current = result.state;
    if (!result.applied) return;
    void applyCorrelatedSnapshot(result.applied);
  }

  function applyPrivateStateFragment(fragment: { version: number; serverTime: number; privateState: PrivatePlayerState }) {
    const result = applyPrivateFragment(snapshotCorrelationRef.current, fragment);
    snapshotCorrelationRef.current = result.state;
    if (!result.applied) return;
    void applyCorrelatedSnapshot(result.applied);
  }

  useEffect(() => {
    if (!room || !info) return;
    const t = window.setTimeout(() => setInfo(''), INFO_MESSAGE_DURATION_MS);
    return () => window.clearTimeout(t);
  }, [room, info]);

  function showEventOverlay(overlay: EventOverlay, ms = 5000) {
    setEventOverlay({ ...overlay, durationMs: ms });
    eventOverlayEndsAtRef.current = Date.now() + ms;
    if (eventOverlayTimeoutRef.current) window.clearTimeout(eventOverlayTimeoutRef.current);
    eventOverlayTimeoutRef.current = window.setTimeout(() => {
      setEventOverlay(null);
      eventOverlayEndsAtRef.current = null;
    }, ms);
  }

  function scheduleLevelCompleteOverlay(payload: { levelCompleted: number; reward: LevelReward }) {
    const currentPileCount = roomRef.current?.game?.pileHistory?.length ?? 0;

    if (pileClearStartTimeoutRef.current) window.clearTimeout(pileClearStartTimeoutRef.current);
    if (levelCompleteOverlayTimeoutRef.current) window.clearTimeout(levelCompleteOverlayTimeoutRef.current);

    setIsPileHidden(false);
    setIsClearingPile(false);

    const hasFreshPileEntry = currentPileCount > prevPileCountRef.current;
    const lastCardSettleMs = hasFreshPileEntry ? 340 : 0;

    pileClearStartTimeoutRef.current = window.setTimeout(() => {
      setIsClearingPile(true);
    }, lastCardSettleMs);

    const overlayDelayMs = levelCompleteOverlayDelayMs({
      currentPileCount,
      previousPileCount: prevPileCountRef.current,
      blockingUntil: eventOverlayEndsAtRef.current,
    });

    levelCompleteOverlayTimeoutRef.current = window.setTimeout(() => {
      const activeLock = roomRef.current?.game?.interactionLock;
      const remainingLockMs =
        activeLock?.reason === 'level-complete' ? Math.max(0, activeLock.until - Date.now()) : 0;

      showEventOverlay(
          {
            kind: 'level-complete',
            title: `LEVEL ${payload.levelCompleted} CLEARED`,
            message: overlaySubtitle('level-complete'),
            tone: 'good',
          reward: payload.reward ?? null,
        },
        Math.max(overlayDurationMs('level-complete'), remainingLockMs),
      );
      setIsPileHidden(true);
      setIsClearingPile(false);
    }, overlayDelayMs);
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

  function toggleGameLog() {
    setLogOpen((current) => !current);
  }

  useEffect(() => {
    roomRef.current = room;
  }, [room]);

  useEffect(() => {
    playerNameRef.current = playerName;
  }, [playerName]);

  function refreshConnectionState(socketConnected: boolean, hasRoom = Boolean(roomRef.current)) {
    setConnectionState(
      deriveConnectionState({
        socketConnected,
        reconnecting: reconnectingRef.current,
        hasRoom,
        syncInFlight: syncInFlightRef.current,
        syncHealthy: syncHealthyRef.current,
      }),
    );
  }

  function clearResyncTimeout() {
    if (!resyncTimeoutRef.current) return;
    window.clearTimeout(resyncTimeoutRef.current);
    resyncTimeoutRef.current = null;
  }

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

    if (room?.code && room.shareable !== false) {
      url.searchParams.set('room', room.code);
    } else {
      url.searchParams.delete('room');
    }

    window.history.replaceState({}, '', url.toString());
  }, [room?.code, room?.shareable]);

  useEffect(() => {
    if (!playerName) return;
    localStorage.setItem(STORAGE_KEYS.playerName, playerName);
  }, [playerName]);

  useEffect(() => {
    if (!playerId) return;

    const s: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    }) as Socket<ServerToClientEvents, ClientToServerEvents>;
    setSocket(s);

    const performResync = (opts?: { forceUiSyncing?: boolean }) => {
      const targetRoom = roomRef.current?.code ?? (localStorage.getItem(STORAGE_KEYS.lastRoomCode) ?? '').trim().toUpperCase();
      const targetName = playerNameRef.current.trim() || (localStorage.getItem(STORAGE_KEYS.playerName) ?? '').trim();

      if (!s.connected || !targetRoom || !targetName || syncInFlightRef.current) {
        refreshConnectionState(Boolean(s.connected), Boolean(targetRoom || roomRef.current));
        return;
      }

      syncInFlightRef.current = true;
      if (opts?.forceUiSyncing) syncHealthyRef.current = false;
      refreshConnectionState(true, true);

      clearResyncTimeout();
      resyncTimeoutRef.current = window.setTimeout(() => {
        syncInFlightRef.current = false;
        syncHealthyRef.current = false;
        refreshConnectionState(Boolean(s.connected), true);
      }, RESYNC_TIMEOUT_MS);

      const joinSentAt = Date.now();
      s.emit('room:join', { roomCode: targetRoom, playerName: targetName, playerId }, (response: JoinRoomAck) => {
        if (!response?.ok) {
          syncInFlightRef.current = false;
          syncHealthyRef.current = false;
          clearResyncTimeout();
          localStorage.removeItem(STORAGE_KEYS.lastRoomCode);
          refreshConnectionState(Boolean(s.connected), true);
          setInfo('Could not restore session automatically.');
          return;
        }

        if (response.snapshot) applyAuthoritativeSnapshot(response.snapshot, { clientSentAt: joinSentAt });

        const resyncSentAt = Date.now();
        s.emit('room:resync', (syncResponse: ResyncAck) => {
          if (!syncResponse?.ok) {
            syncHealthyRef.current = false;
            syncInFlightRef.current = false;
            clearResyncTimeout();
            refreshConnectionState(Boolean(s.connected), true);
            return;
          }

          if (syncResponse.snapshot) {
            applyAuthoritativeSnapshot(syncResponse.snapshot, { forceRevealHand: true, clientSentAt: resyncSentAt });
          }
        });
      });
    };

    s.on('connect', () => {
      socketConnectedRef.current = true;
      reconnectingRef.current = false;
      setError('');

      if (manualAccessRef.current) return;
      if (skipNextAutoJoinRef.current) {
        skipNextAutoJoinRef.current = false;
        return;
      }

      if (!roomRef.current && !(localStorage.getItem(STORAGE_KEYS.lastRoomCode) ?? '').trim()) {
        syncHealthyRef.current = true;
        refreshConnectionState(true, false);
        return;
      }

      performResync({ forceUiSyncing: Boolean(roomRef.current) });
    });

    s.on('disconnect', () => {
      socketConnectedRef.current = false;
      reconnectingRef.current = false;
      syncInFlightRef.current = false;
      syncHealthyRef.current = false;
      clearResyncTimeout();
      refreshConnectionState(false);
      setInfo('Connection lost. Retrying...');
    });

    (s as Socket).on('reconnect_attempt', () => {
      socketConnectedRef.current = false;
      reconnectingRef.current = true;
      syncHealthyRef.current = false;
      refreshConnectionState(false);
    });

    s.on('connect_error', () => {
      socketConnectedRef.current = false;
      reconnectingRef.current = true;
      syncHealthyRef.current = false;
      refreshConnectionState(false);
    });

    s.on('room:snapshot', (snapshot: RoomSnapshot) => {
      if (applyAuthoritativeSnapshot(snapshot) && Array.isArray(snapshot.publicState.logs)) {
        setGameLog(snapshot.publicState.logs.slice(-50));
      }
    });

    s.on('room:update', (payload: PublicRoomEnvelope) => {
      applyPublicStateFragment(payload);
      if (Array.isArray(payload.publicState.logs)) {
        setGameLog(payload.publicState.logs.slice(-50));
      }
    });

    s.on('game:log', (entry: GameLogEvent) => {
      pushLog(entry);
    });

    s.on('player:state', (payload: PrivatePlayerEnvelope) => {
      applyPrivateStateFragment(payload);
    });

    s.on('room:kicked', (payload: { message?: string }) => {
      localStorage.removeItem(STORAGE_KEYS.lastRoomCode);
      skipNextAutoJoinRef.current = true;
      clearRoomState();
      setRoomCodeInput('');
      setAccessTab('join');
      setError(payload?.message ?? 'The host removed you from the room.');
    });

    s.on(
      'game:error-penalty',
      (payload: {
        version?: number;
        playedCard: { value: number; playerId: string; playerName: string };
        blockingCards: Array<{ value: number; playerId: string; playerName: string }>;
      }) => {
        if (!shouldApplyDecorativeEvent(payload?.version, snapshotCorrelationRef.current.lastAppliedVersion)) return;
        showEventOverlay(
          {
            kind: 'error',
            title: 'ERROR',
            message: overlaySubtitle('error'),
            tone: 'error',
            errorData: payload,
          },
          overlayDurationMs('error'),
        );
      },
    );

    s.on('game:paused', (payload: { version?: number; message?: string }) => {
      if (!shouldApplyDecorativeEvent(payload?.version, snapshotCorrelationRef.current.lastAppliedVersion)) return;
      showEventOverlay(
        {
          kind: 'pause',
          title: 'PAUSE REQUESTED',
          message: overlaySubtitle('pause'),
          tone: 'warn',
        },
        overlayDurationMs('pause'),
      );
    });

    s.on('game:star-used', (payload: StarUsedPayload & { version?: number }) => {
      if (!shouldApplyDecorativeEvent(payload?.version, snapshotCorrelationRef.current.lastAppliedVersion)) return;
      const localDiscardCard = findMyStarDiscard(payload?.discarded ?? [], playerId);
      if (localDiscardCard !== null) setPendingLocalStarDiscardCard(localDiscardCard);
      showEventOverlay(
        {
          kind: 'star-used',
          title: 'STAR RESOLVED',
          message: overlaySubtitle('star-used'),
          tone: 'good',
          starDiscards: payload?.discarded ?? [],
        },
        overlayDurationMs('star-used'),
      );
    });
    s.on('game:level-complete', (payload: { version?: number; levelCompleted: number; reward: LevelReward }) => {
      if (!shouldApplyDecorativeEvent(payload?.version, snapshotCorrelationRef.current.lastAppliedVersion)) return;
      scheduleLevelCompleteOverlay(payload);
    });

    s.on('game:next-level-ready', (payload: { version?: number }) => {
      if (!shouldApplyDecorativeEvent(payload?.version, snapshotCorrelationRef.current.lastAppliedVersion)) return;
      // ready state handled via room:update
    });

    s.on('game:restarted', (payload: { version?: number; message?: string }) => {
      if (!shouldApplyDecorativeEvent(payload?.version, snapshotCorrelationRef.current.lastAppliedVersion)) return;
      showEventOverlay(
        {
          kind: 'restarted',
          title: 'GAME RESTARTED',
          message: overlaySubtitle('restarted'),
          tone: 'info',
        },
        overlayDurationMs('restarted'),
      );
    });

    s.on('game:over', (payload: { version?: number }) => {
      if (!shouldApplyDecorativeEvent(payload?.version, snapshotCorrelationRef.current.lastAppliedVersion)) return;
      setEventOverlay(null);
      eventOverlayEndsAtRef.current = null;
    });

    resyncIntervalRef.current = window.setInterval(() => {
      if (!s.connected || !roomRef.current || syncInFlightRef.current) return;

      syncInFlightRef.current = true;
      refreshConnectionState(true, true);

      clearResyncTimeout();
      resyncTimeoutRef.current = window.setTimeout(() => {
        syncInFlightRef.current = false;
        syncHealthyRef.current = false;
        refreshConnectionState(Boolean(s.connected), true);
      }, RESYNC_TIMEOUT_MS);

      const resyncSentAt = Date.now();
      s.emit('room:resync', (response: any) => {
        if (!response?.ok) {
          syncInFlightRef.current = false;
          syncHealthyRef.current = false;
          clearResyncTimeout();
          refreshConnectionState(Boolean(s.connected), true);
          return;
        }

        if (response.snapshot) {
          applyAuthoritativeSnapshot(response.snapshot, { forceRevealHand: true, clientSentAt: resyncSentAt });
        }
      });
    }, RESYNC_INTERVAL_MS);

    return () => {
      if (eventOverlayTimeoutRef.current) window.clearTimeout(eventOverlayTimeoutRef.current);
      if (levelCompleteOverlayTimeoutRef.current) window.clearTimeout(levelCompleteOverlayTimeoutRef.current);
      if (resyncIntervalRef.current) window.clearInterval(resyncIntervalRef.current);
      clearResyncTimeout();
      s.disconnect();
    };
  }, [playerId]);

  useEffect(() => {
    const lock = room?.game?.interactionLock;

    countdownTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    countdownTimeoutsRef.current = [];

    if (!isCountdownLockActive(lock)) {
      setCountdown(null);
      return () => {
        countdownTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      };
    }

    const countdownLock = lock!;

    const refreshCountdown = () => {
      setCountdown(countdownValueFromRemaining(countdownLock.until - getEstimatedServerNow()));
    };

    refreshCountdown();

    [countdownLock.until - 2000, countdownLock.until - 1000, countdownLock.until].forEach((target) => {
      const delay = target - getEstimatedServerNow();
      if (delay > 0) countdownTimeoutsRef.current.push(window.setTimeout(refreshCountdown, delay));
    });

    return () => {
      countdownTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [room?.game?.interactionLock]);

  useEffect(() => {
    const phase = room?.game?.phase ?? null;

    if (phase === 'focus' || phase === 'playing') {
      setIsClearingPile(false);
      setIsPileHidden(false);
    }
  }, [room?.game?.phase]);

  useEffect(() => {
    const handKey = hand.join(',');
    const roomStatus = room?.status ?? null;
    const phase = room?.game?.phase ?? null;
    const currentDealStateKey = handDealStateKey({ handKey, roomStatus, phase });

    if (currentDealStateKey === previousHandDealStateKeyRef.current) {
      return;
    }
    previousHandDealStateKeyRef.current = currentDealStateKey;

    if (dealStartTimeoutRef.current) {
      window.clearTimeout(dealStartTimeoutRef.current);
      dealStartTimeoutRef.current = null;
    }

    if (dealIntervalRef.current) {
      window.clearInterval(dealIntervalRef.current);
      dealIntervalRef.current = null;
    }

    const animationMode = handDealAnimationMode({ handLength: hand.length, roomStatus, phase });

    if (animationMode === 'clear') {
      setDealtHandCount(0);
      return;
    }

    if (animationMode === 'reveal') {
      pendingLobbyDealDelayMsRef.current = 0;
      setDealtHandCount(hand.length);
      return;
    }

    const startDeal = () => {
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
    };

    const delayMs = pendingLobbyDealDelayMsRef.current;
    pendingLobbyDealDelayMsRef.current = 0;
    if (delayMs > 0) {
      dealStartTimeoutRef.current = window.setTimeout(() => {
        dealStartTimeoutRef.current = null;
        startDeal();
      }, delayMs);
    } else {
      startDeal();
    }

    return () => {
      if (dealStartTimeoutRef.current) {
        window.clearTimeout(dealStartTimeoutRef.current);
        dealStartTimeoutRef.current = null;
      }
      if (dealIntervalRef.current) {
        window.clearInterval(dealIntervalRef.current);
        dealIntervalRef.current = null;
      }
    };
  }, [hand, room?.status, room?.game?.phase]);

  useEffect(() => {
    if (hiddenStarDiscardCard === null || hand.includes(hiddenStarDiscardCard)) return;
    setHiddenStarDiscardCard(null);
  }, [hand, hiddenStarDiscardCard]);

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
  const starDiscardedCards = eventOverlay?.starDiscards ?? [];
  const playerColorMap = useMemo(() => buildPlayerColorMap(room?.players ?? []), [room?.players]);
  const playersList = useMemo(() => room?.players ?? [], [room?.players]);
  const rivals = useMemo(
    () =>
      playersList
        .filter((player) => player.id !== playerId)
        .map((player, index) => ({
          ...player,
          corner: RIVAL_POSITIONS[index] ?? 'corner-top-left',
        })),
    [playerId, playersList],
  );
  const playerCornerMap = useMemo(() => {
    const map = new Map<string, string>();
    rivals.forEach((player) => map.set(player.id, player.corner));
    if (playerId) map.set(playerId, SELF_POSITION);
    return map;
  }, [playerId, rivals]);

  useEffect(() => {
    if (!room) {
      setPileEntryMap({});
      return;
    }

    let frame = 0;

    const measurePileEntries = () => {
      const centerPileEl = centerPileRef.current;
      if (!centerPileEl) return;

      const centerRect = centerPileEl.getBoundingClientRect();
      const centerX = centerRect.left + centerRect.width / 2;
      const centerY = centerRect.top + centerRect.height / 2;
      const nextEntries: Record<string, PileEntryOffset> = {};

      playerCornerRefs.current.forEach((node, playerIdForRef) => {
        const cornerRect = node.getBoundingClientRect();
        const cornerX = cornerRect.left + cornerRect.width / 2;
        const cornerY = cornerRect.top + cornerRect.height / 2;
        const corner = playerCornerMap.get(playerIdForRef) ?? SELF_POSITION;
        const fallback = pileEntryOffset(corner);

        nextEntries[playerIdForRef] = {
          x: Math.round(cornerX - centerX),
          y: Math.round(cornerY - centerY),
          rot: fallback.rot,
        };
      });

      setPileEntryMap((previous) => {
        const previousKeys = Object.keys(previous);
        const nextKeys = Object.keys(nextEntries);
        if (
          previousKeys.length === nextKeys.length &&
          nextKeys.every(
            (key) =>
              previous[key]?.x === nextEntries[key]?.x &&
              previous[key]?.y === nextEntries[key]?.y &&
              previous[key]?.rot === nextEntries[key]?.rot,
          )
        ) {
          return previous;
        }
        return nextEntries;
      });
    };

    frame = window.requestAnimationFrame(measurePileEntries);
    window.addEventListener('resize', measurePileEntries);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', measurePileEntries);
    };
  }, [me?.id, playerCornerMap, playersList, room]);

  useEffect(() => {
    prevPileCountRef.current = pileCards.length;
  }, [pileCards]);

  useEffect(() => {
    const latestPileCard = pileCards[pileCards.length - 1];
    const pendingEntry = pendingLocalPileEntryRef.current;
    if (!latestPileCard || !pendingEntry) return;
    if (latestPileCard.playerId !== playerId || latestPileCard.value !== pendingEntry.card) return;

    const clearId = window.requestAnimationFrame(() => {
      pendingLocalPileEntryRef.current = null;
    });
    return () => window.cancelAnimationFrame(clearId);
  }, [pileCards, playerId]);

  useEffect(() => {
    if (pendingLocalStarDiscardCard === null || starDiscardFlight || hiddenStarDiscardCard === pendingLocalStarDiscardCard) return;

    const cardNode = handCardRefs.current.get(pendingLocalStarDiscardCard);
    if (!cardNode) return;
    const rect = cardNode.getBoundingClientRect();

    if (starDiscardLaunchTimeoutRef.current) {
      window.clearTimeout(starDiscardLaunchTimeoutRef.current);
      starDiscardLaunchTimeoutRef.current = null;
    }

    const launchDelayMs = starDiscardLaunchDelayMs(eventOverlayEndsAtRef.current);
    starDiscardLaunchTimeoutRef.current = window.setTimeout(() => {
      setHiddenStarDiscardCard(pendingLocalStarDiscardCard);
      setStarDiscardFlight({
        card: pendingLocalStarDiscardCard,
        startRect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
        },
      });
      starDiscardLaunchTimeoutRef.current = null;
    }, launchDelayMs);

    return () => {
      if (starDiscardLaunchTimeoutRef.current) {
        window.clearTimeout(starDiscardLaunchTimeoutRef.current);
        starDiscardLaunchTimeoutRef.current = null;
      }
    };
  }, [hiddenStarDiscardCard, pendingLocalStarDiscardCard, starDiscardFlight]);

  useEffect(() => {
    const flight = starDiscardFlight;
    const node = starDiscardFlightRef.current;
    if (!flight || !node) return;

    const dx = window.innerWidth - flight.startRect.left + flight.startRect.width * 0.55;
    const dy = window.innerHeight - flight.startRect.top + flight.startRect.height * 0.55;
    const animation = node.animate(
      [
        { transform: 'translate(0px, 0px) rotate(0deg)', opacity: 1 },
        { transform: `translate(${dx}px, ${dy}px) rotate(16deg)`, opacity: 0.14 },
      ],
      {
        duration: 760,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'forwards',
      },
    );

    animation.onfinish = () => {
      setStarDiscardFlight(null);
      setPendingLocalStarDiscardCard(null);
      socket?.emit('star:discard-animation-complete');
    };

    return () => animation.cancel();
  }, [socket, starDiscardFlight]);

  useEffect(() => {
    const nextLives = game?.lives ?? null;
    const nextStars = game?.stars ?? null;
    const nextLevel = game?.currentLevel ?? null;
    const previous = previousResourceRef.current;

    const updates: Partial<{ lives: StatusPulse; stars: StatusPulse; level: StatusPulse }> = {};
    ([
      ['lives', previous.lives, nextLives],
      ['stars', previous.stars, nextStars],
      ['level', previous.level, nextLevel],
    ] as const).forEach(([key, prevValue, nextValue]) => {
      if (prevValue === null || nextValue === null || prevValue === nextValue) return;
      updates[key] = nextValue > prevValue ? 'up' : 'down';
      const timeout = resourcePulseTimeoutsRef.current[key];
      if (timeout) window.clearTimeout(timeout);
      resourcePulseTimeoutsRef.current[key] = window.setTimeout(() => {
        setResourcePulse((current) => ({ ...current, [key]: null }));
      }, 1800);
    });

    if (Object.keys(updates).length > 0) {
      setResourcePulse((current) => ({ ...current, ...updates }));
    }

    previousResourceRef.current = {
      lives: nextLives,
      stars: nextStars,
      level: nextLevel,
    };
  }, [game?.currentLevel, game?.lives, game?.stars]);

  useEffect(
    () => () => {
      Object.values(resourcePulseTimeoutsRef.current).forEach((timeout) => {
        if (timeout) window.clearTimeout(timeout);
      });
    },
    [],
  );

  const isHost = room?.hostId === playerId;
  const isLobbyRoom = room?.status === 'lobby';
  const isPlaying = game?.phase === 'playing';
  const hasStarProposal = !!game?.starProposal;
  const isStarProposalInitiator = game?.starProposal?.initiatorId === playerId;
  const activeInteractionLock = game && isInteractionLockActive(game.interactionLock) ? game.interactionLock : null;

  const minPlayableCard = hand.length > 0 ? Math.min(...hand) : null;
  const isMeRoundOut = !!me && isPlayerRoundOut(me, cardsRemainingForPlayer(me));
  const isMeRoundReturning = !!me && isPlayerRoundReturning(me, cardsRemainingForPlayer(me));
  const isDealingHand = isHandDealInProgress(activeInteractionLock, hand.length, dealtHandCount);
  const interactionBlocked = Boolean(activeInteractionLock) || isDealingHand;
  const readyAction = actionFor('ready');
  const unreadyAction = actionFor('unready');
  const startAction = actionFor('start');
  const playCardAction = actionFor('play_card');
  const pauseAction = actionFor('pause');
  const proposeStarAction = actionFor('propose_star');
  const acceptStarAction = actionFor('accept_star');
  const cancelStarAction = actionFor('cancel_star');
  const rejectStarAction = actionFor('reject_star');
  const roundOutWaitAction = actionFor('round_out_wait');
  const readyOverlayError = readyOverlayBlockedReason(eventOverlay?.kind);
  const readyOverlayBlocked = readyOverlayError !== null;
  const prepLabel =
    activeInteractionLock?.reason === 'dealing'
      ? 'The hive is dealing the next pulse'
      : activeInteractionLock?.reason === 'level-complete'
        ? 'The hive is sealing the completed level'
      : activeInteractionLock?.reason === 'error'
        ? 'The hive is absorbing the mistake'
      : activeInteractionLock?.reason === 'star'
        ? 'The hive is discarding the lowest cards'
      : countdown === null
        ? 'The hive is tuning the next pulse'
        : countdown === 'play'
          ? 'The hive is releasing the swarm'
          : `The hive wakes in ${countdown}`;
  const showReady = Boolean(readyAction?.visible);
  const showNotReady = Boolean(unreadyAction?.visible);
  const showStart = Boolean(startAction?.visible);
  const showPause = Boolean(pauseAction?.visible);
  const starProposalButtons = getStarProposalButtons({
    hasProposal: hasStarProposal,
    isInitiator: Boolean(isStarProposalInitiator),
    canPropose: Boolean(proposeStarAction?.visible),
    canRespond: Boolean(acceptStarAction?.visible),
  });
  const showProposeStar = starProposalButtons.includes('propose');
  const showCancelStar = starProposalButtons.includes('cancel');
  const showAcceptStar = starProposalButtons.includes('accept');
  const showRejectStar = starProposalButtons.includes('reject');
  const showRoundClearingPlaceholder = Boolean(game && (game.phase === 'playing' || game.phase === 'paused') && isMeRoundOut);
  const showHivePlaceholder = Boolean(
    game && (game.phase === 'focus' || activeInteractionLock?.reason === 'dealing' || isCountdownLockActive(activeInteractionLock)),
  );
  const placeholderLabel = showRoundClearingPlaceholder ? 'The hive is still clearing' : prepLabel;
  const currentReward = game ? rewardLabel(game.currentLevel) : 'No reward';
  const currentRewardType = game ? REWARDS[game.currentLevel] ?? null : null;
  const dealtCards = useMemo(() => hand.slice(0, dealtHandCount), [hand, dealtHandCount]);
  const orderedDealtCards = useMemo(() => [...dealtCards].sort((a, b) => a - b), [dealtCards]);
  const handLayout = useMemo(() => buildHandLayout(orderedDealtCards, game?.maxLevel ?? 1), [game?.maxLevel, orderedDealtCards]);
  const primaryCard = handLayout.primaryCard;
  const queueTopRow = handLayout.topRow;
  const queueCurveSlot = handLayout.curveSlot;
  const showQueueCurveSlot = Boolean(queueCurveSlot);
  const queueBottomRow = handLayout.bottomRow;
  const finalResults = game?.finalResults ?? [];
  const showTwoColumnFinalScoreLayout = shouldUseTwoColumnFinalScoreLayout(finalResults.length);
  const hostPlayer = room?.players.find((player) => player.id === room.hostId) ?? null;
  const lobbySeats = useMemo(() => buildLobbySeats(room?.players ?? [], MAX_LOBBY_PLAYERS), [room?.players]);
  const queueCardStyle = (slotId: HandSlotId, card: number | null) => {
    const slotIndex = Math.max(0, handLayout.slotOrder.indexOf(slotId) - 1);
    return {
      ...(card !== null ? { borderColor: playerColorMap.get(playerId) ?? undefined } : {}),
      '--queue-deal-delay': `${slotIndex * 34}ms`,
    } as any;
  };
  const isStarDiscardCard = (card: number | null) => card !== null && pendingLocalStarDiscardCard !== null && card === pendingLocalStarDiscardCard;
  const shouldHideHandCardForStarDiscard = (card: number | null) => card !== null && hiddenStarDiscardCard === card;

  useEffect(() => {
    const phase = room?.game?.phase ?? null;
    const nextSlotMap = handLayout.cardSlotMap;

    if (phase !== 'playing') {
      previousHandSlotMapRef.current = { ...nextSlotMap };
      return;
    }

    const previousSlotMap = previousHandSlotMapRef.current;
    previousHandSlotMapRef.current = { ...nextSlotMap };
    if (Object.keys(previousSlotMap).length === 0) return;

    const frame = window.requestAnimationFrame(() => {
      Object.entries(nextSlotMap).forEach(([cardKey, nextSlotId]) => {
        const card = Number(cardKey);
        const previousSlotId = previousSlotMap[card];
        if (!previousSlotId || previousSlotId === nextSlotId) return;

        const cardNode = handCardRefs.current.get(card);
        const finalSlotNode = handSlotRefs.current.get(nextSlotId);
        if (!cardNode || !finalSlotNode) return;

        const finalRect = finalSlotNode.getBoundingClientRect();
        const path = buildHandSlotPath(previousSlotId, nextSlotId, handLayout.slotOrder);
        const keyframes = path
          .map((slotId) => {
            const slotNode = handSlotRefs.current.get(slotId);
            if (!slotNode) return null;
            const rect = slotNode.getBoundingClientRect();
            return {
              transform: `translate(${rect.left - finalRect.left}px, ${rect.top - finalRect.top}px) scale(${rect.width / finalRect.width}, ${rect.height / finalRect.height})`,
            };
          })
          .filter(Boolean) as Array<{ transform: string }>;

        if (keyframes.length < 2) return;

        cardNode.getAnimations().forEach((animation) => animation.cancel());
        cardNode.animate(keyframes, {
          duration: 220 + Math.max(0, path.length - 1) * 120,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        });
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [handLayout.cardSlotMap, handLayout.slotOrder, room?.game?.phase]);
  const commandActions = buildCommandActions({
    readyAction,
    unreadyAction,
    roundOutWaitAction,
    startAction,
    pauseAction,
    proposeStarAction,
    acceptStarAction,
    cancelStarAction,
    rejectStarAction,
    showCancelStar,
    showAcceptStar,
    showRejectStar,
    showProposeStar,
    showHivePlaceholder: showHivePlaceholder || showRoundClearingPlaceholder,
    placeholderLabel,
    readyOverlayBlocked,
    isInGame: room?.status === 'in-game',
    phase: game?.phase ?? null,
  }).map((action) => ({
    ...action,
    onClick:
      action.key === 'cancel-star'
        ? cancelStarProposal
        : action.key === 'accept-star'
          ? acceptStar
          : action.key === 'reject-star'
            ? rejectStar
            : action.key === 'star'
              ? proposeStar
              : action.key === 'pause'
                ? requestPause
                : action.key === 'start'
                  ? startGame
                  : action.key === 'ready'
                    ? () => setReady(true)
                    : action.key === 'waiting'
                      ? () => setReady(false)
                      : () => {},
  }));
  function saveRoomCode(roomCode: string, inputCode = roomCode) {
    localStorage.setItem(STORAGE_KEYS.lastRoomCode, roomCode);
    setRoomCodeInput(inputCode);
  }

  function clearRoomState() {
    setRoom(null);
    setHand([]);
    setAvailableActions([]);
    setEventOverlay(null);
    setPendingLocalStarDiscardCard(null);
    setHiddenStarDiscardCard(null);
    setStarDiscardFlight(null);
    if (starDiscardLaunchTimeoutRef.current) {
      window.clearTimeout(starDiscardLaunchTimeoutRef.current);
      starDiscardLaunchTimeoutRef.current = null;
    }
    if (dealStartTimeoutRef.current) {
      window.clearTimeout(dealStartTimeoutRef.current);
      dealStartTimeoutRef.current = null;
    }
    if (dealIntervalRef.current) {
      window.clearInterval(dealIntervalRef.current);
      dealIntervalRef.current = null;
    }
    pendingLobbyDealDelayMsRef.current = 0;
    eventOverlayEndsAtRef.current = null;
    setGameLog([]);
    setLogOpen(false);
    snapshotCorrelationRef.current = createSnapshotCorrelationState<RoomState, PrivatePlayerState>();
    serverClockOffsetRef.current = 0;
    prevPileCountRef.current = 0;
    previousHandSlotMapRef.current = {};
    pendingLocalPileEntryRef.current = null;
  }
  function emitWithAck<T>(event: keyof ClientToServerEvents, payload?: unknown): Promise<T> {
    return new Promise((resolve) => {
      if (!socket) {
        resolve({ ok: false, error: 'No socket connection' } as T);
        return;
      }

      if (typeof payload === 'undefined') {
        (socket as Socket).emit(event, (response: T) => resolve(response));
        return;
      }

      (socket as Socket).emit(event, payload, (response: T) => resolve(response));
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

    const requestSentAt = Date.now();
    const response = await emitWithAck<any>('room:create', { playerName, playerId });

    manualAccessRef.current = false;
    setAccessBusy(false);

    if (!response?.ok) {
      setError(response?.error ?? 'Could not create room');
      return;
    }

    if (response.snapshot) applyAuthoritativeSnapshot(response.snapshot, { clientSentAt: requestSentAt, forceRevealHand: true });
    if (response.snapshot?.publicState) {
      saveRoomCode(response.snapshot.publicState.code, response.snapshot.publicState.displayCode ?? response.snapshot.publicState.code);
    }
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

    const requestSentAt = Date.now();
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

    if (response.snapshot) applyAuthoritativeSnapshot(response.snapshot, { clientSentAt: requestSentAt, forceRevealHand: true });
    if (response.snapshot?.publicState) {
      saveRoomCode(response.snapshot.publicState.code, response.snapshot.publicState.displayCode ?? response.snapshot.publicState.code);
    }

  }

  function setReady(ready: boolean) {
    setError('');
    const targetAction = ready ? readyAction : unreadyAction;
    if (!targetAction?.enabled || readyOverlayBlocked) {
      setError(readyOverlayError ?? targetAction?.reason ?? 'Could not update ready state');
      return;
    }
    if (!socket) return;
    socket.emit('player:ready', { ready }, (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not update ready state');
    });
  }

  function startGame() {
    setError('');
    setInfo('');
    if (!startAction?.enabled) {
      setError(startAction?.reason ?? 'Could not start game');
      return;
    }
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
    if (!playCardAction?.enabled) {
      setError(playCardAction?.reason ?? 'You cannot play a card right now');
      return;
    }

    if (card === primaryCard) {
      const primaryNode = handCardRefs.current.get(card);
      const centerNode = centerPileRef.current;
      if (primaryNode && centerNode) {
        const primaryRect = primaryNode.getBoundingClientRect();
        const centerRect = centerNode.getBoundingClientRect();
        pendingLocalPileEntryRef.current = {
          card,
          entry: {
            x: Math.round(primaryRect.left + primaryRect.width / 2 - (centerRect.left + centerRect.width / 2)),
            y: Math.round(primaryRect.top + primaryRect.height / 2 - (centerRect.top + centerRect.height / 2)),
            rot: 0,
          },
        };
      }
    }

    if (!socket) return;
    socket.emit('game:play-card', { card }, (response: any) => {
      if (!response?.ok) {
        pendingLocalPileEntryRef.current = null;
        setError(response?.error ?? 'Could not play card');
      }
    });
  }

  function requestPause() {
    setError('');
    if (!pauseAction?.enabled) {
      setError(pauseAction?.reason ?? 'Could not pause');
      return;
    }
    if (!socket) return;
    socket.emit('game:pause-request', (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not pause');
    });
  }

  function proposeStar() {
    setError('');
    if (!proposeStarAction?.enabled) {
      setError(proposeStarAction?.reason ?? 'Could not propose star');
      return;
    }
    if (!socket) return;
    socket.emit('star:propose', (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not propose star');
    });
  }

  function acceptStar() {
    setError('');
    if (!acceptStarAction?.enabled) {
      setError(acceptStarAction?.reason ?? 'Could not accept star');
      return;
    }
    if (!socket) return;
    socket.emit('star:accept', (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not accept star');
    });
  }

  function cancelStarProposal() {
    setError('');
    if (!cancelStarAction?.enabled) {
      setError(cancelStarAction?.reason ?? 'Could not cancel star proposal');
      return;
    }
    if (!socket) return;
    socket.emit('star:cancel', (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not cancel star proposal');
    });
  }

  function rejectStar() {
    setError('');
    if (!rejectStarAction?.enabled) {
      setError(rejectStarAction?.reason ?? 'Could not reject star');
      return;
    }
    if (!socket) return;
    socket.emit('star:reject', (response: any) => {
      if (!response?.ok) setError(response?.error ?? 'Could not reject star');
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

  function isPlayerRoundOut(player: Player, cardsRemaining: number): boolean {
    return Boolean(
      game &&
      (game.phase === 'playing' || game.phase === 'paused') &&
      cardsRemaining === 0 &&
      player.connected,
    );
  }

  function isPlayerRoundReturning(player: Player, cardsRemaining: number): boolean {
    return Boolean(
      game &&
      game.phase === 'round-complete' &&
      cardsRemaining === 0 &&
      player.connected,
    );
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
    if (!room?.code || room.shareable === false) return;
    const shareUrl = buildShareUrl(room.code);

    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Ignore copy feedback toast for room link actions.
    }
  }

  async function copyLobbyRoomCode() {
    if (!room?.code || room.shareable === false) return;

    try {
      await navigator.clipboard.writeText(buildShareUrl(room.code));
    } catch {
      setError('Could not copy room code');
    }
  }

  return (
    <main className="table-page">
      <AppBackground />
      <header className="topbar">
        <div className="topbar-left">
          {room && shouldShowTopbarRoomCode(room.status) && (
            <button
              className={`topbar-pill room-pill${room.shareable === false ? ' is-private' : ''}`}
              onClick={copyRoomLink}
              disabled={room.shareable === false}
              title={room.shareable === false ? 'Private CPU room' : 'Copy room link'}
              aria-label={room.shareable === false ? `Private CPU room ${room.displayCode ?? room.code}` : `Copy room link for room ${room.code}`}
            >
              <span className="topbar-pill-label">{room.displayCode ?? room.code}</span>
              {room.shareable === false ? (
                <span className="material-symbols-rounded" aria-hidden>
                  lock
                </span>
              ) : (
                <span className="material-symbols-rounded" aria-hidden>
                  content_copy
                </span>
              )}
            </button>
          )}
        </div>
        {room && (
          <div className="topbar-right">
            {room.status === 'in-game' && (
              <button
                className={`topbar-pill${logOpen ? ' active' : ''}`}
                onClick={() => setLogOpen((current) => !current)}
                aria-expanded={logOpen}
                aria-controls="game-log-drawer"
                title="Toggle game log"
              >
                <span className="material-symbols-rounded" aria-hidden>notes</span>
                Log
              </button>
            )}
            {room.status !== 'lobby' && (
              <button className="topbar-pill topbar-exit-pill" onClick={requestAbandonMatch} title="Leave room" aria-label="Leave room">
                <span className="material-symbols-rounded" aria-hidden>logout</span>
                Exit
              </button>
            )}
          </div>
        )}
      </header>

      {(error || info) && (
        <section
          className={`panel status-banner${error ? ' is-error' : ' is-info'}`}
          role={error ? 'alert' : 'status'}
          aria-live="polite"
        >
          <span className="material-symbols-rounded" aria-hidden>
            {error ? 'warning' : 'info'}
          </span>
          <span>{error || info}</span>
        </section>
      )}

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
              <form
                className="lobby-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  void createRoom();
                }}
              >
                <label>
                  Name
                  <input
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Your name"
                  />
                </label>

                <div className="actions align-right">
                  <button type="submit" disabled={accessBusy}>Create room</button>
                </div>
              </form>
            )}

            {accessTab === 'join' && (
              <form
                className="lobby-grid"
                onSubmit={(event) => {
                  event.preventDefault();
                  void joinRoom();
                }}
              >
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
                  <button type="submit" disabled={accessBusy}>Join</button>
                </div>
              </form>
            )}
          </section>
          <RulesPanels />
        </div>
      )}

      {room && isLobbyRoom && (
        <div className="lobby-scroll room-waiting-scroll">
          <div className="room-waiting-stack">
            <MainBrandMark className="waiting-room-brand" />
            <section className="panel waiting-room-panel">
              <div className="waiting-room-shell">
                <div className="lobby-pill-row">
                  <button className="topbar-pill topbar-exit-pill" onClick={requestAbandonMatch} title="Leave room" aria-label="Leave room">
                    <span className="material-symbols-rounded" aria-hidden>logout</span>
                    Exit
                  </button>
                  <button
                    className={`topbar-pill room-pill${room.shareable === false ? ' is-private' : ''}`}
                    onClick={() => void copyLobbyRoomCode()}
                    disabled={room.shareable === false}
                    title={room.shareable === false ? 'Private CPU room' : 'Copy room code'}
                  >
                    <span className="topbar-pill-label">{room.displayCode ?? room.code}</span>
                    {room.shareable === false ? (
                      <span className="material-symbols-rounded" aria-hidden>lock</span>
                    ) : (
                      <span className="material-symbols-rounded" aria-hidden>content_copy</span>
                    )}
                  </button>
                </div>

                <div className="waiting-room-copy compact">
                  <p className="waiting-room-eyebrow">Room lobby</p>
                  <p className="waiting-room-copy-line">{waitingRoomMessage({ isHost, hostName: hostPlayer?.name })}</p>
                </div>

                <div className="waiting-hive-grid" aria-label="Players in room">
                  {lobbySeats.map((player, index) => {
                    if (!player) {
                      return (
                        <article key={`empty-seat-${index}`} className="waiting-player-card is-empty" aria-hidden>
                          <div className="waiting-player-cell">
                            <span className="material-symbols-rounded waiting-player-icon" aria-hidden>add</span>
                          </div>
                        </article>
                      );
                    }

                    const playerColor = playerColorMap.get(player.id);
                    return (
                      <article
                        key={player.id}
                        className={`waiting-player-card${player.id === room.hostId ? ' is-host' : ''}${!player.connected ? ' is-disconnected' : ''}`}
                        style={{ '--player-border-color': playerColor ?? undefined } as any}
                      >
                        <div className="waiting-player-cell">
                          <span className="material-symbols-rounded waiting-player-icon" aria-hidden>
                            person
                          </span>
                          <div className="waiting-player-body">
                            <strong
                              className={`waiting-player-name${player.name.length > 12 ? ' compact' : ''}${player.name.length > 18 ? ' tiny' : ''}`}
                              style={{ color: playerColor }}
                            >
                              {player.name}
                            </strong>
                            <div className="waiting-player-head">
                              {player.isCpu && <span className="waiting-player-badge cpu">CPU</span>}
                            </div>
                            {!player.connected && <span className="waiting-player-status">Reconnecting</span>}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>

                <div className="waiting-room-footer">
                  {isHost ? (
                    <button className="command-button waiting-room-start" onClick={startGame} disabled={!startAction?.enabled}>
                      Start
                    </button>
                  ) : (
                    <p className="waiting-room-footnote">Host starts the run.</p>
                  )}
                </div>
              </div>
            </section>
            <RulesPanels />
          </div>
        </div>
      )}

      {room && !isLobbyRoom && (
        <section className="game-layout">
          <section className="game-shell">
            <section className={`felt-stage${isPlaying ? ' is-playing' : ''}`}>
              <TableBrandMark />
              {rivals.map((player) => {
                const cardsRemaining = cardsRemainingForPlayer(player);
                const isRoundOut = isPlayerRoundOut(player, cardsRemaining);
                const isRoundReturning = isPlayerRoundReturning(player, cardsRemaining);
                return (
                  <article
                    key={player.id}
                    className={`player-corner ${player.corner} ${playerCornerFlipClass(player.corner)}${isRoundOut ? ' is-round-out' : ''}${isRoundReturning ? ' is-round-returning' : ''}`}
                    ref={setPlayerCornerRef(player.id)}
                    style={{ '--player-border-color': playerColorMap.get(player.id) ?? undefined } as any}
                    title={isRoundOut ? `${player.name} finished this round` : undefined}
                  >
                    <div className="player-corner-face player-corner-front">
                      <span
                        className="material-symbols-rounded player-corner-status-icon"
                        aria-label={statusLabelForSeat(player, game?.phase)}
                        title={statusLabelForSeat(player, game?.phase)}
                      >
                          {statusIconForSeat(player, game?.phase)}
                      </span>
                      {player.id === room.hostId && (
                        <span className="material-symbols-rounded player-corner-host" aria-label="Host">crown</span>
                      )}
                      {player.isCpu && (
                        <span className="player-corner-cpu" aria-label="CPU player" title="CPU player">CPU</span>
                      )}
                      <strong className={playerCornerNameClass(player.name)} style={{ color: playerColorMap.get(player.id) }}>
                        {player.name}
                      </strong>
                      <span className="player-corner-count">x{cardsRemaining}</span>
                    </div>
                    <div className="player-corner-face player-corner-back" aria-hidden>
                      <span className="player-corner-back-label">DONE</span>
                      <strong className="player-corner-back-name">{player.name}</strong>
                    </div>
                  </article>
                );
              })}
              {me && (
                <article
                  className={`player-corner own-player-corner ${SELF_POSITION} ${playerCornerFlipClass(SELF_POSITION)}${isMeRoundOut ? ' is-round-out' : ''}${isMeRoundReturning ? ' is-round-returning' : ''}`}
                  ref={setPlayerCornerRef(me.id)}
                  style={{ '--player-border-color': playerColorMap.get(me.id) ?? undefined } as any}
                  title={isMeRoundOut ? 'You finished this round' : undefined}
                >
                  <div className="player-corner-face player-corner-front">
                    <span
                      className="material-symbols-rounded player-corner-status-icon"
                      aria-label={statusLabelForSeat(me, game?.phase)}
                      title={statusLabelForSeat(me, game?.phase)}
                    >
                      {statusIconForSeat(me, game?.phase)}
                    </span>
                    {me.id === room.hostId && (
                      <span className="material-symbols-rounded player-corner-host" aria-label="Host">crown</span>
                    )}
                    {me.isCpu && (
                      <span className="player-corner-cpu" aria-label="CPU player" title="CPU player">CPU</span>
                    )}
                    <strong className={playerCornerNameClass(me.name)} style={{ color: playerColorMap.get(me.id) }}>
                      {me.name}
                    </strong>
                    <span className="player-corner-count">x{cardsRemainingForPlayer(me)}</span>
                  </div>
                  <div className="player-corner-face player-corner-back" aria-hidden>
                    <span className="player-corner-back-label">DONE</span>
                    <strong className="player-corner-back-name">{me.name}</strong>
                  </div>
                </article>
              )}

              <div
                className={`center-pile ${isClearingPile ? ' clearing' : ''}${logOpen ? ' is-log-open' : ''}`}
                aria-label="Center pile. Open game log"
                aria-controls="game-log-drawer"
                aria-expanded={logOpen}
                onClick={toggleGameLog}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleGameLog();
                  }
                }}
                ref={centerPileRef}
                role="button"
                tabIndex={0}
              >
                {!isPileHidden && pileCards.length === 0 && <div className="pile-empty">Play the first card</div>}

                {!isPileHidden &&
                  pileCards.map((card, index) => (
                  <article
                    key={`${card.value}-${index}`}
                    className="card face pile"
                    style={{
                      ...pileStyle(
                        index,
                        card.value,
                        pendingLocalPileEntryRef.current &&
                          card.playerId === playerId &&
                          card.value === pendingLocalPileEntryRef.current.card
                          ? pendingLocalPileEntryRef.current.entry
                          : (pileEntryMap[card.playerId] ?? pileEntryOffset(playerCornerMap.get(card.playerId) ?? SELF_POSITION)),
                      ),
                      '--clear-delay': `${index * 48}ms`,
                      borderColor: playerColorMap.get(card.playerId) ?? undefined,
                    } as any}
                  >
                    <span className="corner tl">{card.value}</span>
                    <span className="center">{card.value}</span>
                    <span className="corner br">{card.value}</span>
                  </article>
                  ))}

                {currentRewardType && (
                  <div className="felt-reward" aria-label="Round reward">
                    <span className="felt-reward-label">Reward</span>
                    <span className="material-symbols-rounded felt-reward-icon" aria-hidden>
                      {rewardTypeIcon(currentRewardType)}
                    </span>
                  </div>
                )}

              </div>

              {countdown && (
                <div className="countdown-overlay">
                  <div className={`count-number ${countdown === 'play' ? 'play' : ''}`}>
                    {countdown === 'play' ? 'PLAY' : countdown}
                  </div>
                </div>
              )}

              {eventOverlay && game?.phase !== 'victory' && game?.phase !== 'game-over' && (
                <div className={`countdown-overlay event-message-overlay ${eventOverlay.tone}`} aria-live="polite">
                  <div className="event-message-stack">
                    <h2 className={`event-message-headline ${eventOverlay.tone}`}>{eventOverlay.title}</h2>

                    {eventOverlay.tone === 'error' && eventOverlay.errorData && (
                      <>
                        <p className="error-compact-line">
                          <span
                            className="error-number"
                            style={{ color: playerColorMap.get(eventOverlay.errorData.playedCard.playerId) }}
                          >
                            {eventOverlay.errorData.playedCard.value}
                          </span>
                          {' > '}
                          {(eventOverlay.errorData.blockingCards ?? []).map((card, idx) => (
                            <span key={`${card.playerId}-${card.value}-${idx}`}>
                              <span className="error-number" style={{ color: playerColorMap.get(card.playerId) }}>
                                {card.value}
                              </span>
                              {idx < ((eventOverlay.errorData?.blockingCards.length ?? 0) - 1) ? ', ' : ''}
                            </span>
                          ))}
                        </p>
                        <p className="error-life-loss">-1 ❤</p>
                      </>
                    )}

                    {eventOverlay.message && <p className="event-message-copy">{eventOverlay.message}</p>}

                    {eventOverlay.reward && (
                      <div className={`event-message-reward ${eventOverlay.reward}`}>
                        <span className="event-message-reward-value">
                          <span className="material-symbols-rounded" aria-hidden>{rewardTypeIcon(eventOverlay.reward)}</span>
                          {rewardTypeLabel(eventOverlay.reward)}
                        </span>
                      </div>
                    )}

                    <div className="overlay-progress-track event-message-progress" aria-hidden>
                      <div
                        className="overlay-progress-fill"
                        style={{ '--overlay-ms': `${eventOverlay.durationMs ?? 5000}ms` } as any}
                      />
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
                  <h2>YOU WON</h2>
                  <p className="event-message-detail result-subtitle">{VICTORY_SUBTITLE}</p>
                  {finalResults.length > 0 && (
                    <div className={`final-scoreboard${showTwoColumnFinalScoreLayout ? ' two-columns' : ''}`} aria-label="Final synchronization ranking">
                      {finalResults.map((result, index) => (
                        <article
                          key={result.playerId}
                          className={`final-score-row podium-${podiumToneForRank(index)}${result.playerId === playerId ? ' is-me' : ''}`}
                        >
                          {podiumToneForRank(index) !== 'none' && (
                            <span className={`final-score-crown-ribbon podium-${podiumToneForRank(index)}`} aria-label={`${podiumToneForRank(index)} podium`}>
                              <span className="material-symbols-rounded" aria-hidden>crown</span>
                            </span>
                          )}
                          <div className="final-score-rank">#{index + 1}</div>
                          <div className="final-score-copy">
                            <div className="final-score-head">
                              <strong>{result.playerName}</strong>
                              <span className={`final-score-band band-${timingFeedbackForBand(result.timingBand).toLowerCase()}`}>{timingFeedbackForBand(result.timingBand)}</span>
                            </div>
                          </div>
                          <div className="final-score-value">
                            <strong>{result.score}</strong>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  <div className="actions centered">
                    {isHost ? (
                      <button onClick={retryMatch}>Retry</button>
                    ) : (
                      <span className="muted">Waiting for the host to retry.</span>
                    )}
                    <button onClick={requestAbandonMatch}>Leave room</button>
                  </div>
                </div>
              )}

              {game?.phase === 'game-over' && (
                <div className="result-overlay defeat">
                  <h2>
                    <span className="material-symbols-rounded inline-icon" aria-hidden>
                      skull
                    </span>{' '}
                    YOU LOST
                  </h2>
                  <p className="event-message-detail result-subtitle">{DEFEAT_SUBTITLE}</p>
                  {finalResults.length > 0 && (
                    <div className={`final-scoreboard${showTwoColumnFinalScoreLayout ? ' two-columns' : ''}`} aria-label="Final synchronization ranking">
                      {finalResults.map((result, index) => (
                        <article
                          key={result.playerId}
                          className={`final-score-row podium-${podiumToneForRank(index)}${result.playerId === playerId ? ' is-me' : ''}`}
                        >
                          {podiumToneForRank(index) !== 'none' && (
                            <span className={`final-score-crown-ribbon podium-${podiumToneForRank(index)}`} aria-label={`${podiumToneForRank(index)} podium`}>
                              <span className="material-symbols-rounded" aria-hidden>crown</span>
                            </span>
                          )}
                          <div className="final-score-rank">#{index + 1}</div>
                          <div className="final-score-copy">
                            <div className="final-score-head">
                              <strong>{result.playerName}</strong>
                              <span className={`final-score-band band-${timingFeedbackForBand(result.timingBand).toLowerCase()}`}>{timingFeedbackForBand(result.timingBand)}</span>
                            </div>
                          </div>
                          <div className="final-score-value">
                            <strong>{result.score}</strong>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                  <div className="actions centered">
                    {isHost ? (
                      <button onClick={retryMatch}>Retry</button>
                    ) : (
                      <span className="muted">Waiting for the host to retry.</span>
                    )}
                    <button onClick={requestAbandonMatch}>Leave room</button>
                  </div>
                </div>
              )}
            </section>

            <section className="command-deck panel">
              <div className="command-panel">
                <div className="command-top-row">
                  <div className="command-status-group" aria-label="Player resources">
                    <span className={`status-item compact-status${resourcePulse.lives ? ` is-${resourcePulse.lives}` : ''}`}>
                      <strong>
                        <span className="material-symbols-rounded inline-icon" aria-hidden>
                          favorite
                        </span>
                        Lives
                      </strong>
                      {game?.lives ?? '-'}
                    </span>
                    <span className={`status-item compact-status${resourcePulse.stars ? ` is-${resourcePulse.stars}` : ''}`}>
                      <strong>
                        <span className="material-symbols-rounded inline-icon" aria-hidden>
                          star
                        </span>
                        Stars
                      </strong>
                      {game?.stars ?? '-'}
                    </span>
                    <span className={`status-item compact-status${resourcePulse.level ? ` is-${resourcePulse.level}` : ''}`}>
                      <strong>
                        <span className="material-symbols-rounded inline-icon" aria-hidden>
                          floor
                        </span>
                        Level
                      </strong>
                      {game ? `${game.currentLevel}/${game.maxLevel}` : '-'}
                    </span>
                  </div>
                </div>

                <div className="command-action-row">
                  {commandActions.map((action) => (
                    <button
                      key={action.key}
                      className={`${action.className}${action.key === 'ready' || action.key === 'waiting' || action.key === 'hive-sync' ? ' full-span' : ''}`}
                      onClick={action.onClick}
                      disabled={action.disabled}
                    >
                      <span className="material-symbols-rounded" aria-hidden>{action.icon}</span>
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="deck-panel">
                <div className="command-hand-row">
                  <div className={`command-queue${showQueueCurveSlot ? ' has-curve' : ''}${primaryCard === null ? ' is-empty' : ''}`} aria-label="Upcoming cards">
                    {queueCurveSlot && (
                      <div className="queue-slot-shell queue-curve-shell" ref={setHandSlotRef(queueCurveSlot.id)}>
                        <div
                          ref={setHandCardRef(queueCurveSlot.card)}
                          className={`card face queue-card queue-curve${queueCurveSlot.card !== null ? ' filled' : ' ghost'}${isStarDiscardCard(queueCurveSlot.card) ? ' is-star-discarding' : ''}${shouldHideHandCardForStarDiscard(queueCurveSlot.card) ? ' hand-card-hidden-for-flight' : ''}`}
                          aria-hidden={queueCurveSlot.card === null}
                          style={queueCardStyle(queueCurveSlot.id, queueCurveSlot.card)}
                        >
                          {queueCurveSlot.card !== null ? <span className="center">{queueCurveSlot.card}</span> : <span className="queue-slot-ghost-dot" />}
                          {isStarDiscardCard(queueCurveSlot.card) && <span className="star-discard-x" />}
                        </div>
                      </div>
                    )}
                    <div className="queue-grid">
                      <div className="queue-row queue-row-top">
                        {queueTopRow.map((slot) => (
                          <div key={slot.id} className="queue-slot-shell" ref={setHandSlotRef(slot.id)}>
                            <div
                              ref={setHandCardRef(slot.card)}
                              className={`card face queue-card${slot.card !== null ? ' filled' : ' ghost'}${isStarDiscardCard(slot.card) ? ' is-star-discarding' : ''}${shouldHideHandCardForStarDiscard(slot.card) ? ' hand-card-hidden-for-flight' : ''}`}
                              aria-hidden={slot.card === null}
                              style={queueCardStyle(slot.id, slot.card)}
                            >
                              {slot.card !== null ? <span className="center">{slot.card}</span> : <span className="queue-slot-ghost-dot" />}
                              {isStarDiscardCard(slot.card) && <span className="star-discard-x" />}
                            </div>
                          </div>
                        ))}
                      </div>
                      {queueBottomRow.length > 0 && (
                        <div className="queue-row queue-row-bottom">
                          {queueBottomRow.map((slot) => {
                            return (
                              <div key={slot.id} className="queue-slot-shell" ref={setHandSlotRef(slot.id)}>
                                <div
                                  ref={setHandCardRef(slot.card)}
                                  className={`card face queue-card${slot.card !== null ? ' filled' : ' ghost'}${isStarDiscardCard(slot.card) ? ' is-star-discarding' : ''}${shouldHideHandCardForStarDiscard(slot.card) ? ' hand-card-hidden-for-flight' : ''}`}
                                  aria-hidden={slot.card === null}
                                  style={queueCardStyle(slot.id, slot.card)}
                                >
                                  {slot.card !== null ? <span className="center">{slot.card}</span> : <span className="queue-slot-ghost-dot" />}
                                  {isStarDiscardCard(slot.card) && <span className="star-discard-x" />}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {primaryCard !== null ? (
                    <div className="primary-slot-shell" ref={setHandSlotRef('primary')}>
                      <button
                        ref={setHandCardRef(primaryCard)}
                        className={`card face primary-card${playCardAction?.enabled && primaryCard === minPlayableCard ? ' playable' : ''}${isStarDiscardCard(primaryCard) ? ' is-star-discarding' : ''}${shouldHideHandCardForStarDiscard(primaryCard) ? ' hand-card-hidden-for-flight' : ''}`}
                        onClick={() => playCard(primaryCard)}
                        disabled={!playCardAction?.enabled || primaryCard !== minPlayableCard}
                        title="Play this card"
                        style={{ borderColor: playerColorMap.get(playerId) ?? undefined } as any}
                      >
                        <span className="corner tl">{primaryCard}</span>
                        <span className="center">{primaryCard}</span>
                        <span className="corner br">{primaryCard}</span>
                        {isStarDiscardCard(primaryCard) && <span className="star-discard-x" />}
                      </button>
                    </div>
                  ) : (
                    <div className="primary-slot-shell" ref={setHandSlotRef('primary')}>
                      <div className="primary-card-empty">No card</div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </section>

          {starDiscardFlight && (
            <div className="floating-card-layer" aria-hidden>
              <article
                ref={starDiscardFlightRef}
                className="card face floating-card floating-star-discard"
                style={{
                  left: `${starDiscardFlight.startRect.left}px`,
                  top: `${starDiscardFlight.startRect.top}px`,
                  width: `${starDiscardFlight.startRect.width}px`,
                  height: `${starDiscardFlight.startRect.height}px`,
                  borderColor: playerColorMap.get(playerId) ?? undefined,
                } as any}
              >
                <span className="corner tl">{starDiscardFlight.card}</span>
                <span className="center">{starDiscardFlight.card}</span>
                <span className="corner br">{starDiscardFlight.card}</span>
                <span className="star-discard-x" />
              </article>
            </div>
          )}

          <aside id="game-log-drawer" className={`log-drawer panel${logOpen ? ' open' : ''}`} aria-label="Game log">
            <header className="log-drawer-header">
              <strong>Game log</strong>
              <button className="log-drawer-close" onClick={() => setLogOpen(false)} aria-label="Close game log">
                <span className="material-symbols-rounded" aria-hidden>close</span>
              </button>
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
          </aside>
        </section>
      )}

      {room && showExitConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card exit-modal">
            <h3>Leave room</h3>
            <p>
              {isLobbyRoom
                ? 'Are you sure you want to leave this room?'
                : 'Are you sure you want to leave? You will lose the current game in this room.'}
            </p>
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
    </main>
  );
}
