# Graph Report - .  (2026-06-27)

## Corpus Check
- 91 files · ~253,061 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 240 nodes · 475 edges · 17 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 201 · calls: 104 · imports: 80 · MODIFIES: 40 · imports_from: 23 · ON_BRANCH: 14 · PARENT_OF: 13


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 91 · Candidates: 159
- Excluded: 20 untracked · 9208 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `4afcaf7`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `startGameInRoom()` - 12 edges
2. `playCardInRoom()` - 12 edges
3. `resolveStarIfEveryoneAccepted()` - 10 edges
4. `App()` - 10 edges
5. `emitRoomUpdate()` - 8 edges
6. `settlePendingStarResolution()` - 8 edges
7. `removePlayerCompletely()` - 8 edges
8. `resetDevCpuRoomToLobby()` - 7 edges
9. `buildPrivateState()` - 6 edges
10. `emitGameLog()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `4afcaf7 Fixes` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 2 → community 6_
- `acknowledgeStarDiscardAnimation()` --calls--> `settlePendingStarResolution()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 12 → community 5_
- `buildPrivateState()` --calls--> `hasActiveInteractionLock()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 13 → community 5_
- `markSocketDisconnected()` --calls--> `emitRoomUpdate()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 12 → community 13_
- `removePlayerCompletely()` --calls--> `clearCpuTurn()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 16 → community 5_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (27): ActionType, AvailableAction, EventOverlay, FinalPlayerResult, GameLogEvent, GameLogType, GamePhase, InteractionLock (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (25): app, clampNumber(), cpuPlayTimers, createUniqueRoomCode(), DEV_CPU_PLAY_DELAY_MS, GAME_BALANCE, GameState, generateRoomCode() (+17 more)

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (15): 4afcaf7 Fixes, b33fd54 Playability improved + star activation visual improved  + preformance resume for feedback, f473312 Sync front and back refactor, FinalPodiumTone, FinalTimingBand, FinalTimingFeedback, podiumToneForRank(), shouldUseTwoColumnFinalScoreLayout() (+7 more)

### Community 3 - "Community 3"
Cohesion: 0.20
Nodes (14): applyStarDiscardPreview(), createInteractionLock(), discardLowerCards(), discardLowestCardPerPlayer(), getDealLockDuration(), InteractionLock, InteractionLockReason, isInteractionLockActive() (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.23
Nodes (14): applyPrivateFragment(), applyPrivateSnapshot(), applyPublicFragment(), createSnapshotCorrelationState(), estimateServerClockOffset(), estimateServerNow(), isExpiredDecorativeWindow(), PrivateRoomSnapshot (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.23
Nodes (15): beginRoundCountdown(), clearCpuTurn(), countRemainingCards(), finalizeStarResolution(), findGlobalLowestCard(), hasActiveInteractionLock(), nextFunctionalVersion(), playCardInRoom() (+7 more)

### Community 6 - "Community 6"
Cohesion: 0.31
Nodes (12): main, 1acf7ce Allow .onrender.com in Vite and serve production build in frontend Dockerfile, 3936f3d Add render configuration for backend and frontend services, 438e4ac feat: initialize frontend with TypeScript, Vite, and Docker setup, 6298188 8 player enabled + animations and look & feel, 787acde feat(frontend): support runtime VITE_SOCKET_URL via env-config and entrypoint, 7f4f063 feat(frontend): load runtime env-config.js before bundle, 89861bb vhost: allow exact Render frontend hostname (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.18
Nodes (6): calculateFinalResults(), FinalPlayerResult, FinalTimingBand, PlayerMeta, RecordedPlay, players

### Community 8 - "Community 8"
Cohesion: 0.20
Nodes (9): App(), pickMessage(), playerCornerFlipClass(), playerCornerNameClass(), rewardLabel(), rewardTypeIcon(), rewardTypeLabel(), statusIconForSeat() (+1 more)

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (10): buildDeck(), buildRewardMap(), clearInteractionLockTimer(), dealLevel(), gameModeForRoom(), initialLivesByPlayers(), isDevCpuRoom(), markCpuPlayersReady() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.27
Nodes (7): action(), blockedReason(), buildPrivateActions(), InteractionLockReason, PrivateAction, PrivateActionContext, PrivateActionType

### Community 11 - "Community 11"
Cohesion: 0.44
Nodes (7): countdownValueFromRemaining(), InteractionLock, InteractionLockReason, isCountdownLockActive(), isHandDealInProgress(), isInteractionLockActive(), isReadyLocked()

### Community 12 - "Community 12"
Cohesion: 0.22
Nodes (9): acknowledgeStarDiscardAnimation(), applyLevelReward(), completeLevelOrGame(), emitGameLog(), finalizeGameResults(), getLevelReward(), getPlayerName(), markSocketDisconnected() (+1 more)

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (9): buildPrivateState(), canStartGame(), createPrivateStateEnvelope(), createPublicRoomEnvelope(), createRoomSnapshot(), emitRoomUpdate(), isActiveRoundParticipant(), isRoundParticipationPhase() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.48
Nodes (5): findMyStarDiscard(), mergeHandWithStarDiscard(), shouldUseTwoColumnStarDiscardLayout(), StarDiscardPreview, discarded

### Community 15 - "Community 15"
Cohesion: 0.53
Nodes (4): connectionIcon(), connectionLabel(), ConnectionState, deriveConnectionState()

### Community 16 - "Community 16"
Cohesion: 0.47
Nodes (6): clearLevelCompleteTimer(), clearPendingStarResolution(), clearStarResolutionTimer(), getHumanPlayers(), removePlayerCompletely(), resetDevCpuRoomToLobby()

## Knowledge Gaps
- **68 isolated node(s):** `players`, `RecordedPlay`, `FinalTimingBand`, `PlayerMeta`, `InteractionLockReason` (+63 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildPrivateActions()` connect `Community 10` to `Community 1`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **Why does `applyPrivateSnapshot()` connect `Community 4` to `Community 0`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Why does `isInteractionLockActive()` connect `Community 11` to `Community 0`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `players`, `RecordedPlay`, `FinalTimingBand` to the rest of the system?**
  _68 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07096774193548387 - nodes in this community are weakly interconnected._