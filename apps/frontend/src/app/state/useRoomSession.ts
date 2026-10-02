import { useEffect, useReducer, useRef, useState } from 'react';
import type {
  BasicAck,
  GameLogEvent,
  PrivatePlayerEnvelope,
  PrivatePlayerState,
  PublicRoomEnvelope,
  PublicRoomState,
  RoomSnapshot,
  ServerToClientEvents,
} from '@the-hive/contracts';
import { createRoomGateway, type RoomGateway } from '../gateway/index.js';
import { deriveConnectionState, RESYNC_INTERVAL_MS, RESYNC_TIMEOUT_MS, type ConnectionState } from '../../connectionStatus.js';
import {
  applyPrivateFragment as correlatePrivateFragment,
  applyPrivateSnapshot,
  applyPublicFragment as correlatePublicFragment,
  createSnapshotCorrelationState,
  estimateServerClockOffset,
  shouldApplyDecorativeEvent,
  type SnapshotCorrelationState,
} from '../../roomSync.js';
import { initialServerState, roomSessionReducer } from './roomSessionReducer.js';

const STORAGE_KEYS = {
  playerId: 'th:playerId',
  playerName: 'th:playerName',
  lastRoomCode: 'th:lastRoomCode',
};

export type DecorativeEvent =
  | { id: number; type: 'error'; payload: Parameters<ServerToClientEvents['game:error-penalty']>[0] }
  | { id: number; type: 'paused'; payload: Parameters<ServerToClientEvents['game:paused']>[0] }
  | { id: number; type: 'star-used'; payload: Parameters<ServerToClientEvents['game:star-used']>[0] }
  | { id: number; type: 'level-complete'; payload: Parameters<ServerToClientEvents['game:level-complete']>[0] }
  | { id: number; type: 'restarted'; payload: Parameters<ServerToClientEvents['game:restarted']>[0] }
  | { id: number; type: 'game-over'; payload: Parameters<ServerToClientEvents['game:over']>[0] };

export type SessionTransition = {
  version: number;
  previousRoomStatus: PublicRoomState['status'] | null;
  forceRevealHand: boolean;
};

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
  const code = new URLSearchParams(window.location.search).get('room') ?? '';
  return code.trim().toUpperCase();
}

export function useRoomSession(socketUrl: string) {
  const [serverState, dispatch] = useReducer(roomSessionReducer, undefined, initialServerState);
  const [playerId, setPlayerId] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [accessTab, setAccessTab] = useState<'create' | 'join'>('join');
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [gameLog, setGameLog] = useState<GameLogEvent[]>([]);
  const [decorativeEvent, setDecorativeEvent] = useState<DecorativeEvent | null>(null);
  const [kickedMessage, setKickedMessage] = useState<string | null>(null);
  const [sessionTransition, setSessionTransition] = useState<SessionTransition | null>(null);
  const gatewayRef = useRef<RoomGateway | null>(null);
  const roomRef = useRef<PublicRoomState | null>(null);
  const playerNameRef = useRef('');
  const manualAccessRef = useRef(false);
  const skipNextAutoJoinRef = useRef(false);
  const reconnectingRef = useRef(false);
  const socketConnectedRef = useRef(false);
  const syncInFlightRef = useRef(false);
  const syncHealthyRef = useRef(false);
  const resyncIntervalRef = useRef<number | null>(null);
  const resyncTimeoutRef = useRef<number | null>(null);
  const serverClockOffsetRef = useRef(0);
  const snapshotCorrelationRef = useRef<SnapshotCorrelationState<PublicRoomState, PrivatePlayerState>>(createSnapshotCorrelationState());
  const decorativeEventIdRef = useRef(0);

  const refreshConnectionState = (socketConnected: boolean, hasRoom = Boolean(roomRef.current)) => {
    setConnectionState(deriveConnectionState({ socketConnected, reconnecting: reconnectingRef.current, hasRoom, syncInFlight: syncInFlightRef.current, syncHealthy: syncHealthyRef.current }));
  };

  const clearResyncTimeout = () => {
    if (resyncTimeoutRef.current) window.clearTimeout(resyncTimeoutRef.current);
    resyncTimeoutRef.current = null;
  };

  const resetRoom = () => {
    dispatch({ type: 'room-cleared' });
    setGameLog([]);
    setDecorativeEvent(null);
    roomRef.current = null;
    snapshotCorrelationRef.current = createSnapshotCorrelationState();
    serverClockOffsetRef.current = 0;
  };

  const commitSnapshot = (snapshot: RoomSnapshot, options?: { forceRevealHand?: boolean; clientSentAt?: number }) => {
    if (typeof options?.clientSentAt === 'number') {
      serverClockOffsetRef.current = estimateServerClockOffset({ clientSentAt: options.clientSentAt, clientReceivedAt: Date.now(), serverTime: snapshot.serverTime });
    }
    const previousRoomStatus = roomRef.current?.status ?? null;
    roomRef.current = snapshot.publicState;
    dispatch({ type: 'snapshot-applied', snapshot });
    setSessionTransition({
      version: snapshot.version,
      previousRoomStatus,
      forceRevealHand: Boolean(options?.forceRevealHand),
    });
    if (Array.isArray(snapshot.publicState.logs)) setGameLog(snapshot.publicState.logs.slice(-50));
    syncHealthyRef.current = true;
    syncInFlightRef.current = false;
    clearResyncTimeout();
    refreshConnectionState(socketConnectedRef.current, true);
    return true;
  };

  const applySnapshot = (snapshot: RoomSnapshot, options?: { forceRevealHand?: boolean; clientSentAt?: number }) => {
    const result = applyPrivateSnapshot(snapshotCorrelationRef.current, snapshot);
    snapshotCorrelationRef.current = result.state;
    return result.applied ? commitSnapshot(result.applied, options) : false;
  };

  const applyPublicFragment = (fragment: PublicRoomEnvelope) => {
    const result = correlatePublicFragment(snapshotCorrelationRef.current, fragment);
    snapshotCorrelationRef.current = result.state;
    if (result.applied) commitSnapshot(result.applied);
  };

  const applyPrivateFragment = (fragment: PrivatePlayerEnvelope) => {
    const result = correlatePrivateFragment(snapshotCorrelationRef.current, fragment);
    snapshotCorrelationRef.current = result.state;
    if (result.applied) commitSnapshot(result.applied);
  };

  const beginResync = (forceUiSyncing = false, rejoin = true) => {
    const gateway = gatewayRef.current;
    const targetRoom = roomRef.current?.code ?? (localStorage.getItem(STORAGE_KEYS.lastRoomCode) ?? '').trim().toUpperCase();
    const targetName = playerNameRef.current.trim() || (localStorage.getItem(STORAGE_KEYS.playerName) ?? '').trim();
    if (!gateway?.connected || !targetRoom || !targetName || syncInFlightRef.current) {
      refreshConnectionState(Boolean(gateway?.connected), Boolean(targetRoom || roomRef.current));
      return;
    }
    syncInFlightRef.current = true;
    if (forceUiSyncing) syncHealthyRef.current = false;
    refreshConnectionState(true, true);
    clearResyncTimeout();
    resyncTimeoutRef.current = window.setTimeout(() => {
      syncInFlightRef.current = false;
      syncHealthyRef.current = false;
      refreshConnectionState(Boolean(gateway.connected), true);
    }, RESYNC_TIMEOUT_MS);
    if (!rejoin) {
      const sentAt = Date.now();
      void gateway.resyncRoom().then((response) => {
        syncInFlightRef.current = false;
        clearResyncTimeout();
        syncHealthyRef.current = response.ok;
        if (response.ok) applySnapshot(response.snapshot, { clientSentAt: sentAt });
        refreshConnectionState(gateway.connected, true);
      });
      return;
    }
    const joinSentAt = Date.now();
    void gateway.joinRoom({ roomCode: targetRoom, playerName: targetName, playerId }).then((response) => {
      if (!response.ok) {
        syncInFlightRef.current = false;
        syncHealthyRef.current = false;
        clearResyncTimeout();
        localStorage.removeItem(STORAGE_KEYS.lastRoomCode);
        refreshConnectionState(gateway.connected, true);
        return;
      }
      applySnapshot(response.snapshot, { clientSentAt: joinSentAt });
      const resyncSentAt = Date.now();
      void gateway.resyncRoom().then((resyncResponse) => {
        if (!resyncResponse.ok) return;
        applySnapshot(resyncResponse.snapshot, { forceRevealHand: true, clientSentAt: resyncSentAt });
      });
    });
  };

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
    playerNameRef.current = playerName;
    if (playerName) localStorage.setItem(STORAGE_KEYS.playerName, playerName);
  }, [playerName]);

  useEffect(() => {
    roomRef.current = serverState.room;
  }, [serverState.room]);

  useEffect(() => {
    if (!playerId) return;
    const gateway = createRoomGateway(socketUrl);
    gatewayRef.current = gateway;
    gateway.on({
      connect: () => {
        socketConnectedRef.current = true;
        reconnectingRef.current = false;
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
        beginResync(Boolean(roomRef.current));
      },
      disconnect: () => {
        socketConnectedRef.current = false;
        reconnectingRef.current = false;
        syncInFlightRef.current = false;
        syncHealthyRef.current = false;
        clearResyncTimeout();
        refreshConnectionState(false);
      },
      reconnectAttempt: () => {
        socketConnectedRef.current = false;
        reconnectingRef.current = true;
        syncHealthyRef.current = false;
        refreshConnectionState(false);
      },
      connectError: () => {
        socketConnectedRef.current = false;
        reconnectingRef.current = true;
        syncHealthyRef.current = false;
        refreshConnectionState(false);
      },
      'room:snapshot': applySnapshot,
      'room:update': applyPublicFragment,
      'player:state': applyPrivateFragment,
      'game:log': (entry) => setGameLog((previous) => previous.some((item) => item.id === entry.id) ? previous : [...previous, entry].slice(-50)),
      'room:kicked': (payload) => {
        localStorage.removeItem(STORAGE_KEYS.lastRoomCode);
        skipNextAutoJoinRef.current = true;
        resetRoom();
        setRoomCodeInput('');
        setAccessTab('join');
        setKickedMessage(payload.message);
      },
      'game:error-penalty': (payload) => {
        if (shouldApplyDecorativeEvent(payload.version, snapshotCorrelationRef.current.lastAppliedVersion)) {
          setDecorativeEvent({ id: ++decorativeEventIdRef.current, type: 'error', payload });
        }
      },
      'game:paused': (payload) => {
        if (shouldApplyDecorativeEvent(payload.version, snapshotCorrelationRef.current.lastAppliedVersion)) {
          setDecorativeEvent({ id: ++decorativeEventIdRef.current, type: 'paused', payload });
        }
      },
      'game:star-used': (payload) => {
        if (shouldApplyDecorativeEvent(payload.version, snapshotCorrelationRef.current.lastAppliedVersion)) {
          setDecorativeEvent({ id: ++decorativeEventIdRef.current, type: 'star-used', payload });
        }
      },
      'game:level-complete': (payload) => {
        if (shouldApplyDecorativeEvent(payload.version, snapshotCorrelationRef.current.lastAppliedVersion)) {
          setDecorativeEvent({ id: ++decorativeEventIdRef.current, type: 'level-complete', payload });
        }
      },
      'game:next-level-ready': () => {},
      'game:restarted': (payload) => {
        if (shouldApplyDecorativeEvent(payload.version, snapshotCorrelationRef.current.lastAppliedVersion)) {
          setDecorativeEvent({ id: ++decorativeEventIdRef.current, type: 'restarted', payload });
        }
      },
      'game:over': (payload) => {
        if (shouldApplyDecorativeEvent(payload.version, snapshotCorrelationRef.current.lastAppliedVersion)) {
          setDecorativeEvent({ id: ++decorativeEventIdRef.current, type: 'game-over', payload });
        }
      },
    });
    resyncIntervalRef.current = window.setInterval(() => {
      if (gateway.connected && roomRef.current && !syncInFlightRef.current) beginResync(false, false);
    }, RESYNC_INTERVAL_MS);
    return () => {
      if (resyncIntervalRef.current) window.clearInterval(resyncIntervalRef.current);
      clearResyncTimeout();
      gateway.disconnect();
      gatewayRef.current = null;
    };
  }, [playerId, socketUrl]);

  const withGateway = <T,>(action: (gateway: RoomGateway) => Promise<T>): Promise<T | BasicAck> => {
    const gateway = gatewayRef.current;
    return gateway ? action(gateway) : Promise.resolve({ ok: false, error: 'No socket connection' });
  };

  const saveRoom = (snapshot: RoomSnapshot) => {
    localStorage.setItem(STORAGE_KEYS.lastRoomCode, snapshot.publicState.code);
    setRoomCodeInput(snapshot.publicState.displayCode ?? snapshot.publicState.code);
  };

  return {
    ...serverState,
    playerId, playerName, setPlayerName, roomCodeInput, setRoomCodeInput, accessTab, setAccessTab,
    connectionState, gameLog, decorativeEvent, kickedMessage, clearKickedMessage: () => setKickedMessage(null), sessionTransition,
    serverClockOffsetRef, resetRoom,
    createRoom: async () => {
      manualAccessRef.current = true;
      const sentAt = Date.now();
      const response = await withGateway((gateway) => gateway.createRoom({ playerName, playerId }));
      manualAccessRef.current = false;
      if (response.ok && 'snapshot' in response) {
        applySnapshot(response.snapshot, { forceRevealHand: true, clientSentAt: sentAt });
        saveRoom(response.snapshot);
      }
      return response;
    },
    joinRoom: async (roomCode: string) => {
      manualAccessRef.current = true;
      const sentAt = Date.now();
      const response = await withGateway((gateway) => gateway.joinRoom({ roomCode, playerName, playerId }));
      manualAccessRef.current = false;
      if (response.ok && 'snapshot' in response) {
        applySnapshot(response.snapshot, { forceRevealHand: true, clientSentAt: sentAt });
        saveRoom(response.snapshot);
      }
      return response;
    },
    leaveRoom: () => withGateway((gateway) => gateway.leaveRoom()),
    setReady: (ready: boolean) => withGateway((gateway) => gateway.setReady(ready)),
    startGame: () => withGateway((gateway) => gateway.startGame()),
    retryGame: () => withGateway((gateway) => gateway.retryGame()),
    playCard: (card: number) => withGateway((gateway) => gateway.playCard(card)),
    requestPause: () => withGateway((gateway) => gateway.requestPause()),
    proposeStar: () => withGateway((gateway) => gateway.proposeStar()),
    acceptStar: () => withGateway((gateway) => gateway.acceptStar()),
    cancelStar: () => withGateway((gateway) => gateway.cancelStar()),
    rejectStar: () => withGateway((gateway) => gateway.rejectStar()),
    completeStarDiscardAnimation: () => withGateway((gateway) => gateway.completeStarDiscardAnimation()),
    abandonRoom: () => { localStorage.removeItem(STORAGE_KEYS.lastRoomCode); skipNextAutoJoinRef.current = true; },
  };
}
