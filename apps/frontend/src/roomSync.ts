export type VersionedPublicState<TPublicState> = {
  version: number;
  serverTime: number;
  publicState: TPublicState;
};

export type VersionedPrivateState<TPrivateState> = {
  version: number;
  serverTime: number;
  privateState: TPrivateState;
};

export type PrivateRoomSnapshot<TPublicState, TPrivateState> = {
  version: number;
  serverTime: number;
  publicState: TPublicState;
  privateState: TPrivateState;
};

export type SnapshotCorrelationState<TPublicState, TPrivateState> = {
  lastAppliedVersion: number;
  pendingPublic: Record<number, VersionedPublicState<TPublicState>>;
  pendingPrivate: Record<number, VersionedPrivateState<TPrivateState>>;
};

export function createSnapshotCorrelationState<TPublicState, TPrivateState>(): SnapshotCorrelationState<TPublicState, TPrivateState> {
  return {
    lastAppliedVersion: 0,
    pendingPublic: {},
    pendingPrivate: {},
  };
}

function prunePending<TPublicState, TPrivateState>(state: SnapshotCorrelationState<TPublicState, TPrivateState>) {
  const pendingPublic = Object.fromEntries(
    Object.entries(state.pendingPublic).filter(([version]) => Number(version) > state.lastAppliedVersion),
  ) as SnapshotCorrelationState<TPublicState, TPrivateState>['pendingPublic'];
  const pendingPrivate = Object.fromEntries(
    Object.entries(state.pendingPrivate).filter(([version]) => Number(version) > state.lastAppliedVersion),
  ) as SnapshotCorrelationState<TPublicState, TPrivateState>['pendingPrivate'];

  return {
    ...state,
    pendingPublic,
    pendingPrivate,
  };
}

export function applyPrivateSnapshot<TPublicState, TPrivateState>(
  state: SnapshotCorrelationState<TPublicState, TPrivateState>,
  snapshot: PrivateRoomSnapshot<TPublicState, TPrivateState>,
) {
  if (snapshot.version <= state.lastAppliedVersion) {
    return { state, applied: null as PrivateRoomSnapshot<TPublicState, TPrivateState> | null };
  }

  const nextState = prunePending({
    lastAppliedVersion: snapshot.version,
    pendingPublic: state.pendingPublic,
    pendingPrivate: state.pendingPrivate,
  });

  return {
    state: nextState,
    applied: snapshot,
  };
}

function tryAssembleCorrelatedSnapshot<TPublicState, TPrivateState>(
  state: SnapshotCorrelationState<TPublicState, TPrivateState>,
  version: number,
) {
  const publicFragment = state.pendingPublic[version];
  const privateFragment = state.pendingPrivate[version];

  if (!publicFragment || !privateFragment) {
    return { state, applied: null as PrivateRoomSnapshot<TPublicState, TPrivateState> | null };
  }

  const pendingPublic = { ...state.pendingPublic };
  const pendingPrivate = { ...state.pendingPrivate };
  delete pendingPublic[version];
  delete pendingPrivate[version];

  return {
    state: prunePending({
      lastAppliedVersion: version,
      pendingPublic,
      pendingPrivate,
    }),
    applied: {
      version,
      serverTime: Math.max(publicFragment.serverTime, privateFragment.serverTime),
      publicState: publicFragment.publicState,
      privateState: privateFragment.privateState,
    },
  };
}

export function applyPublicFragment<TPublicState, TPrivateState>(
  state: SnapshotCorrelationState<TPublicState, TPrivateState>,
  fragment: VersionedPublicState<TPublicState>,
) {
  if (fragment.version <= state.lastAppliedVersion) {
    return { state, applied: null as PrivateRoomSnapshot<TPublicState, TPrivateState> | null };
  }

  return tryAssembleCorrelatedSnapshot(
    {
      ...state,
      pendingPublic: { ...state.pendingPublic, [fragment.version]: fragment },
    },
    fragment.version,
  );
}

export function applyPrivateFragment<TPublicState, TPrivateState>(
  state: SnapshotCorrelationState<TPublicState, TPrivateState>,
  fragment: VersionedPrivateState<TPrivateState>,
) {
  if (fragment.version <= state.lastAppliedVersion) {
    return { state, applied: null as PrivateRoomSnapshot<TPublicState, TPrivateState> | null };
  }

  return tryAssembleCorrelatedSnapshot(
    {
      ...state,
      pendingPrivate: { ...state.pendingPrivate, [fragment.version]: fragment },
    },
    fragment.version,
  );
}

export function estimateServerClockOffset(sample: { clientSentAt: number; clientReceivedAt: number; serverTime: number }): number {
  const estimatedServerAtReceive = sample.serverTime + (sample.clientReceivedAt - sample.clientSentAt) / 2;
  return estimatedServerAtReceive - sample.clientReceivedAt;
}

export function estimateServerNow(clockOffsetMs: number, clientNow = Date.now()): number {
  return clientNow + clockOffsetMs;
}

export function shouldApplyDecorativeEvent(eventVersion: number | undefined, appliedVersion: number): boolean {
  return typeof eventVersion === 'number' && (eventVersion === appliedVersion || eventVersion === appliedVersion + 1);
}

export function isExpiredDecorativeWindow(endsAt: number | undefined, clockOffsetMs: number, clientNow = Date.now()): boolean {
  if (typeof endsAt !== 'number') return false;
  return estimateServerNow(clockOffsetMs, clientNow) >= endsAt;
}
