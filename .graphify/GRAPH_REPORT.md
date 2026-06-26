# Graph Report - .  (2026-06-26)

## Corpus Check
- 54 files · ~231,623 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 126 nodes · 215 edges · 11 communities detected
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output
- Edge kinds: contains: 110 · calls: 69 · MODIFIES: 13 · ON_BRANCH: 11 · PARENT_OF: 10 · imports: 1 · imports_from: 1


## Input Scope
- Requested: auto
- Resolved: committed (source: default-auto)
- Included files: 54 · Candidates: 67
- Excluded: 67 untracked · 5548 ignored · 0 sensitive · 0 missing committed
- Recommendation: Use --scope all or graphify.yaml inputs.corpus for a knowledge-base folder.

## Graph Freshness
- Built from Git commit: `9d3c17b`
- Compare this hash to `git rev-parse HEAD` before trusting freshness-sensitive graph output.
## God Nodes (most connected - your core abstractions)
1. `startGameInRoom()` - 12 edges
2. `playCardInRoom()` - 11 edges
3. `App()` - 10 edges
4. `resolveStarIfEveryoneAccepted()` - 7 edges
5. `removePlayerCompletely()` - 7 edges
6. `emitRoomUpdate()` - 6 edges
7. `emitGameLog()` - 6 edges
8. `clearCpuTurn()` - 6 edges
9. `setInteractionLock()` - 6 edges
10. `resetDevCpuRoomToLobby()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `beginRoundCountdown()` --calls--> `clearCpuTurn()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 3 → community 2_
- `completeLevelOrGame()` --calls--> `emitGameLog()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 6 → community 2_
- `playCardInRoom()` --calls--> `finalizeGameResults()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 3 → community 6_
- `startGameInRoom()` --calls--> `dealLevel()`  [EXTRACTED]
  apps/backend/src/index.ts → apps/backend/src/index.ts  _Bridges community 2 → community 7_

## Communities

### Community 1 - "Community 1"
Cohesion: 0.08
Nodes (17): Player, RewardType, StarProposal, PileEntry, GameState, Room, rooms, playerRoom (+9 more)

### Community 9 - "Community 9"
Cohesion: 1.00
Nodes (2): generateRoomCode(), createUniqueRoomCode()

### Community 8 - "Community 8"
Cohesion: 1.00
Nodes (2): clampNumber(), parseCpuRoomCode()

### Community 2 - "Community 2"
Cohesion: 0.16
Nodes (18): serializeRoom(), emitRoomUpdate(), emitGameLog(), getPlayerName(), maxLevelByPlayers(), initialLivesByPlayers(), buildRewardMap(), isDevCpuRoom() (+10 more)

### Community 7 - "Community 7"
Cohesion: 1.00
Nodes (2): buildDeck(), dealLevel()

### Community 3 - "Community 3"
Cohesion: 0.20
Nodes (14): clearInteractionLockTimer(), hasActiveInteractionLock(), setInteractionLock(), beginRoundCountdown(), findGlobalLowestCard(), getActiveRoundParticipants(), hasAllReadyForRound(), countRemainingCards() (+6 more)

### Community 10 - "Community 10"
Cohesion: 1.00
Nodes (2): isRoundParticipationPhase(), isActiveRoundParticipant()

### Community 6 - "Community 6"
Cohesion: 0.50
Nodes (4): applyLevelReward(), getLevelReward(), finalizeGameResults(), completeLevelOrGame()

### Community 0 - "Community 0"
Cohesion: 0.06
Nodes (22): Player, GamePhase, InteractionLock, RoomState, FinalPlayerResult, PileCard, LevelReward, EventOverlay (+14 more)

### Community 5 - "Community 5"
Cohesion: 0.20
Nodes (9): pickMessage(), rewardLabel(), rewardTypeLabel(), rewardTypeIcon(), statusIconForSeat(), statusLabelForSeat(), playerCornerFlipClass(), playerCornerNameClass() (+1 more)

### Community 4 - "Community 4"
Cohesion: 0.31
Nodes (12): 1acf7ce Allow .onrender.com in Vite and serve production build in frontend Dockerfile, 3936f3d Add render configuration for backend and frontend services, 438e4ac feat: initialize frontend with TypeScript, Vite, and Docker setup, 6298188 8 player enabled + animations and look & feel, 787acde feat(frontend): support runtime VITE_SOCKET_URL via env-config and entrypoint, 7f4f063 feat(frontend): load runtime env-config.js before bundle, 89861bb vhost: allow exact Render frontend hostname, 9d3c17b new features (+4 more)

## Knowledge Gaps
- **39 isolated node(s):** `Player`, `RewardType`, `StarProposal`, `PileEntry`, `GameState` (+34 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 9`** (2 nodes): `generateRoomCode()`, `createUniqueRoomCode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 8`** (2 nodes): `clampNumber()`, `parseCpuRoomCode()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 7`** (2 nodes): `buildDeck()`, `dealLevel()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 10`** (2 nodes): `isRoundParticipationPhase()`, `isActiveRoundParticipant()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `startGameInRoom()` connect `Community 2` to `Community 1`, `Community 3`, `Community 7`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `playCardInRoom()` connect `Community 3` to `Community 1`, `Community 2`, `Community 6`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Why does `App()` connect `Community 5` to `Community 0`?**
  _High betweenness centrality (0.002) - this node is a cross-community bridge._
- **What connects `Player`, `RewardType`, `StarProposal` to the rest of the system?**
  _39 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.08333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._