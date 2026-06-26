# Graph Report - .  (2026-06-26)

## Corpus Check
- 86 files · ~247,878 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 202 nodes · 383 edges · 15 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 169 · calls: 83 · imports: 58 · MODIFIES: 31 · imports_from: 19 · ON_BRANCH: 12 · PARENT_OF: 11


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 86 · Candidates: 137
- Excluded: 5 untracked · 5550 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `b33fd54`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `startGameInRoom()` - 12 edges
2. `playCardInRoom()` - 12 edges
3. `App()` - 10 edges
4. `resolveStarIfEveryoneAccepted()` - 8 edges
5. `emitRoomUpdate()` - 7 edges
6. `removePlayerCompletely()` - 7 edges
7. `buildPrivateState()` - 6 edges
8. `emitGameLog()` - 6 edges
9. `clearCpuTurn()` - 6 edges
10. `setInteractionLock()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `9d3c17b new features` --PARENT_OF--> `b33fd54 Playability improved + star activation visual improved  + preformance resume for feedback`  [EXTRACTED]
  git → git  _Bridges community 3 → community 2_
- `beginRoundCountdown()` --calls--> `clearCpuTurn()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 4 → community 11_
- `buildPrivateState()` --calls--> `hasActiveInteractionLock()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 9 → community 4_
- `completeLevelOrGame()` --calls--> `emitGameLog()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 14 → community 7_
- `completeLevelOrGame()` --calls--> `nextFunctionalVersion()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 14 → community 4_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (35): ActionType, App(), AvailableAction, EventOverlay, FinalPlayerResult, GameLogEvent, GameLogType, GamePhase (+27 more)

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (23): app, clampNumber(), cpuPlayTimers, createUniqueRoomCode(), DEV_CPU_PLAY_DELAY_MS, GAME_BALANCE, GameState, generateRoomCode() (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.21
Nodes (11): b33fd54 Playability improved + star activation visual improved  + preformance resume for feedback, connectionIcon(), connectionLabel(), ConnectionState, deriveConnectionState(), deferOverlayMs(), OVERLAY_DURATIONS_MS, OVERLAY_SUBTITLES (+3 more)

### Community 3 - "Community 3"
Cohesion: 0.31
Nodes (12): main, 1acf7ce Allow .onrender.com in Vite and serve production build in frontend Dockerfile, 3936f3d Add render configuration for backend and frontend services, 438e4ac feat: initialize frontend with TypeScript, Vite, and Docker setup, 6298188 8 player enabled + animations and look & feel, 787acde feat(frontend): support runtime VITE_SOCKET_URL via env-config and entrypoint, 7f4f063 feat(frontend): load runtime env-config.js before bundle, 89861bb vhost: allow exact Render frontend hostname (+4 more)

### Community 4 - "Community 4"
Cohesion: 0.23
Nodes (13): beginRoundCountdown(), clearInteractionLockTimer(), countRemainingCards(), findGlobalLowestCard(), hasActiveInteractionLock(), nextFunctionalVersion(), playCardInRoom(), resolveErrorAndDiscard() (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.18
Nodes (6): calculateFinalResults(), FinalPlayerResult, FinalTimingBand, PlayerMeta, RecordedPlay, players

### Community 6 - "Community 6"
Cohesion: 0.31
Nodes (8): createInteractionLock(), discardLowerCards(), discardLowestCardPerPlayer(), getDealLockDuration(), InteractionLock, InteractionLockReason, isInteractionLockActive(), StarDiscardPreview

### Community 7 - "Community 7"
Cohesion: 0.22
Nodes (10): buildDeck(), buildRewardMap(), dealLevel(), emitGameLog(), getPlayerName(), initialLivesByPlayers(), markSocketDisconnected(), maxLevelByPlayers() (+2 more)

### Community 8 - "Community 8"
Cohesion: 0.44
Nodes (7): countdownValueFromRemaining(), InteractionLock, InteractionLockReason, isCountdownLockActive(), isHandDealInProgress(), isInteractionLockActive(), isReadyLocked()

### Community 9 - "Community 9"
Cohesion: 0.25
Nodes (9): buildPrivateState(), canStartGame(), createPrivateStateEnvelope(), createPublicRoomEnvelope(), createRoomSnapshot(), emitRoomUpdate(), isActiveRoundParticipant(), isRoundParticipationPhase() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.36
Nodes (6): FinalPodiumTone, FinalTimingBand, FinalTimingFeedback, podiumToneForRank(), shouldUseTwoColumnFinalScoreLayout(), timingFeedbackForBand()

### Community 11 - "Community 11"
Cohesion: 0.32
Nodes (8): clearCpuTurn(), clearLevelCompleteTimer(), gameModeForRoom(), getHumanPlayers(), isDevCpuRoom(), markCpuPlayersReady(), removePlayerCompletely(), resetDevCpuRoomToLobby()

### Community 12 - "Community 12"
Cohesion: 0.48
Nodes (5): findMyStarDiscard(), mergeHandWithStarDiscard(), shouldUseTwoColumnStarDiscardLayout(), StarDiscardPreview, discarded

### Community 13 - "Community 13"
Cohesion: 0.53
Nodes (4): levelCompleteOverlayDelayMs(), LevelCompleteOverlayInput, nextLevelAdvanceDelayMs(), nextLevelReadyLockMs()

### Community 14 - "Community 14"
Cohesion: 0.50
Nodes (4): applyLevelReward(), completeLevelOrGame(), finalizeGameResults(), getLevelReward()

## Knowledge Gaps
- **58 isolated node(s):** `players`, `RecordedPlay`, `FinalTimingBand`, `PlayerMeta`, `InteractionLockReason` (+53 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `calculateFinalResults()` connect `Community 5` to `Community 1`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `isInteractionLockActive()` connect `Community 8` to `Community 0`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `startGameInRoom()` connect `Community 7` to `Community 1`, `Community 4`, `Community 11`, `Community 9`?**
  _High betweenness centrality (0.001) - this node is a cross-community bridge._
- **What connects `players`, `RecordedPlay`, `FinalTimingBand` to the rest of the system?**
  _58 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.04846938775510204 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07635467980295567 - nodes in this community are weakly interconnected._