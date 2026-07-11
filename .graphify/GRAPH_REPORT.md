# Graph Report - .  (2026-06-28)

## Corpus Check
- 104 files · ~271,866 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 275 nodes · 564 edges · 19 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 228 · calls: 112 · imports: 107 · MODIFIES: 56 · imports_from: 30 · ON_BRANCH: 16 · PARENT_OF: 15


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 104 · Candidates: 192
- Excluded: 22 untracked · 9214 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `8608e9e`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `playCardInRoom()` - 13 edges
2. `startGameInRoom()` - 12 edges
3. `resolveStarIfEveryoneAccepted()` - 10 edges
4. `App()` - 10 edges
5. `emitRoomUpdate()` - 9 edges
6. `clearCpuTurn()` - 8 edges
7. `settlePendingStarResolution()` - 8 edges
8. `removePlayerCompletely()` - 8 edges
9. `emitGameLog()` - 7 edges
10. `resetDevCpuRoomToLobby()` - 7 edges

## Surprising Connections (you probably didn't know these)
- `42063ed Animation for card hand` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 2 → community 7_
- `42063ed Animation for card hand` --PARENT_OF--> `8608e9e Star activation buttons refactor + event messages conflicts resolved`  [EXTRACTED]
  git → git  _Bridges community 2 → community 4_
- `8608e9e Star activation buttons refactor + event messages conflicts resolved` --ON_BRANCH--> `main`  [EXTRACTED]
  git → git  _Bridges community 4 → community 7_
- `9d3c17b new features` --PARENT_OF--> `b33fd54 Playability improved + star activation visual improved  + preformance resume for feedback`  [EXTRACTED]
  git → git  _Bridges community 7 → community 3_
- `f473312 Sync front and back refactor` --PARENT_OF--> `4afcaf7 Fixes`  [EXTRACTED]
  git → git  _Bridges community 3 → community 2_

## Communities

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (27): ActionType, AvailableAction, EventOverlay, FinalPlayerResult, GameLogEvent, GameLogType, GamePhase, InteractionLock (+19 more)

### Community 1 - "Community 1"
Cohesion: 0.07
Nodes (23): app, clampNumber(), cpuPlayTimers, createUniqueRoomCode(), DEV_CPU_PLAY_DELAY_MS, GAME_BALANCE, GameState, generateRoomCode() (+15 more)

### Community 2 - "Community 2"
Cohesion: 0.12
Nodes (22): 42063ed Animation for card hand, 4afcaf7 Fixes, applyStarDiscardPreview(), createInteractionLock(), discardLowerCards(), discardLowestCardPerPlayer(), getDealLockDuration(), InteractionLockReason (+14 more)

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (14): b33fd54 Playability improved + star activation visual improved  + preformance resume for feedback, f473312 Sync front and back refactor, FinalPodiumTone, FinalTimingBand, FinalTimingFeedback, podiumToneForRank(), shouldUseTwoColumnFinalScoreLayout(), timingFeedbackForBand() (+6 more)

### Community 4 - "Community 4"
Cohesion: 0.21
Nodes (12): 8608e9e Star activation buttons refactor + event messages conflicts resolved, getRoundResolutionOutcome(), RoundResolutionOutcome, shouldResolveAfterErrorOverlay(), findMyStarDiscard(), getStarProposalButtons(), mergeHandWithStarDiscard(), shouldUseTwoColumnStarDiscardLayout() (+4 more)

### Community 5 - "Community 5"
Cohesion: 0.23
Nodes (14): applyPrivateFragment(), applyPrivateSnapshot(), applyPublicFragment(), createSnapshotCorrelationState(), estimateServerClockOffset(), estimateServerNow(), isExpiredDecorativeWindow(), PrivateRoomSnapshot (+6 more)

### Community 6 - "Community 6"
Cohesion: 0.26
Nodes (12): countdownValueFromRemaining(), GamePhase, handDealAnimationMode(), handDealStateKey(), InteractionLock, InteractionLockReason, isCountdownLockActive(), isHandDealInProgress() (+4 more)

### Community 7 - "Community 7"
Cohesion: 0.31
Nodes (12): main, 1acf7ce Allow .onrender.com in Vite and serve production build in frontend Dockerfile, 3936f3d Add render configuration for backend and frontend services, 438e4ac feat: initialize frontend with TypeScript, Vite, and Docker setup, 6298188 8 player enabled + animations and look & feel, 787acde feat(frontend): support runtime VITE_SOCKET_URL via env-config and entrypoint, 7f4f063 feat(frontend): load runtime env-config.js before bundle, 89861bb vhost: allow exact Render frontend hostname (+4 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (6): calculateFinalResults(), FinalPlayerResult, FinalTimingBand, PlayerMeta, RecordedPlay, players

### Community 9 - "Community 9"
Cohesion: 0.20
Nodes (9): App(), pickMessage(), playerCornerFlipClass(), playerCornerNameClass(), rewardLabel(), rewardTypeIcon(), rewardTypeLabel(), statusIconForSeat() (+1 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (10): beginRoundCountdown(), buildPrivateState(), canStartGame(), countConnectedPlayers(), createPrivateStateEnvelope(), findGlobalLowestCard(), hasActiveInteractionLock(), isActiveRoundParticipant() (+2 more)

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (10): clearCpuTurn(), clearLevelCompleteTimer(), clearPendingStarResolution(), gameModeForRoom(), getHumanPlayers(), isDevCpuRoom(), markCpuPlayersReady(), pauseRoundForReady() (+2 more)

### Community 12 - "Community 12"
Cohesion: 0.27
Nodes (7): action(), blockedReason(), buildPrivateActions(), InteractionLockReason, PrivateAction, PrivateActionContext, PrivateActionType

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (9): applyLevelReward(), completeLevelOrGame(), emitGameLog(), finalizeGameResults(), finishGameOver(), getLevelReward(), nextFunctionalVersion(), playCardInRoom() (+1 more)

### Community 14 - "Community 14"
Cohesion: 0.28
Nodes (9): clearStarResolutionTimer(), countRemainingCards(), finalizeStarResolution(), getActiveRoundParticipants(), hasAllReadyForRound(), resolveStar(), resolveStarIfEveryoneAccepted(), scheduleLevelCompletionAfterRoundOut() (+1 more)

### Community 15 - "Community 15"
Cohesion: 0.29
Nodes (8): acknowledgeStarDiscardAnimation(), createPublicRoomEnvelope(), createRoomSnapshot(), emitRoomUpdate(), getPlayerName(), markSocketDisconnected(), pickNextHost(), serializeRoom()

### Community 16 - "Community 16"
Cohesion: 0.29
Nodes (8): buildDeck(), buildRewardMap(), clearInteractionLockTimer(), dealLevel(), initialLivesByPlayers(), maxLevelByPlayers(), setInteractionLock(), startGameInRoom()

### Community 17 - "Community 17"
Cohesion: 0.43
Nodes (5): InteractionLock, levelCompleteOverlayDelayMs(), LevelCompleteOverlayInput, nextLevelAdvanceDelayMs(), nextLevelReadyLockMs()

### Community 18 - "Community 18"
Cohesion: 0.53
Nodes (4): connectionIcon(), connectionLabel(), ConnectionState, deriveConnectionState()

## Knowledge Gaps
- **76 isolated node(s):** `players`, `RecordedPlay`, `FinalTimingBand`, `PlayerMeta`, `InteractionLockReason` (+71 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `buildPrivateActions()` connect `Community 12` to `Community 1`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `applyPrivateSnapshot()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **Why does `estimateServerNow()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `players`, `RecordedPlay`, `FinalTimingBand` to the rest of the system?**
  _76 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.047619047619047616 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07389162561576355 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.12169312169312169 - nodes in this community are weakly interconnected._