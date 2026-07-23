import type { PrivatePlayerEnvelope, PrivatePlayerState, PublicRoomEnvelope, PublicRoomState, RoomSnapshot } from '@the-hive/contracts';
import { buildPrivateActions } from '../../privateState.js';
import { isInteractionLockActive } from '../../gameTiming.js';
import { playParticipants, readyParticipants } from '../../domain/participants.js';
import type { MachineState } from '../../domain/stateMachine.js';
import type { ApplicationPlayer, ApplicationRoom } from '../../application/model.js';
import type { Clock } from '../../application/ports/clock.js';

type RuntimeRoom = ApplicationRoom & { game: (ApplicationRoom['game'] & { starProposal?: { initiatorId: string; acceptedBy: string[] | Set<string> } | null }) | null };

/** The only adapter that combines application room state with Socket.IO wire envelopes. */
export class RoomPresenter {
  constructor(private readonly clock: Clock) {}

  publicState(room: RuntimeRoom): PublicRoomState {
    return {
      code: room.code,
      displayCode: room.displayCode ?? room.code,
      shareable: room.shareable ?? true,
      hostId: room.hostId,
      status: room.status,
      players: Object.values(room.players).map((player) => ({ id: player.id, name: player.name, connected: player.connected, ready: player.ready, handCount: player.hand.length, isCpu: player.isCpu })),
      game: room.game ? {
        phase: room.game.phase,
        currentLevel: room.game.currentLevel,
        maxLevel: room.game.maxLevel,
        lives: room.game.lives,
        stars: room.game.stars,
        pile: room.game.pile,
        pileHistory: room.game.pileHistory,
        lastPlayed: room.game.lastPlayed,
        mode: room.game.mode,
        interactionLock: room.game.interactionLock,
        finalResults: room.game.finalResults,
        starProposal: room.game.starProposal ? { initiatorId: room.game.starProposal.initiatorId, acceptedBy: Array.from(room.game.starProposal.acceptedBy) } : null,
      } : null,
      logs: room.logs as PublicRoomState['logs'],
    };
  }

  privateState(room: RuntimeRoom, player: ApplicationPlayer, now = this.clock.now()): PrivatePlayerState {
    const game = room.game;
    const machineState: MachineState = {
      roomStatus: room.status,
      phase: game?.phase ?? null,
      lock: game?.interactionLock ?? null,
      lives: game?.lives ?? 0,
      stars: game?.stars ?? 0,
      hasStarProposal: Boolean(game?.starProposal),
      starInitiatorId: game?.starProposal?.initiatorId ?? null,
      acceptedStarBy: game?.starProposal ? Array.from(game.starProposal.acceptedBy) : [],
      isHost: room.hostId === player.id,
      actorId: player.id,
      players: Object.values(room.players).map((entry) => ({ id: entry.id, connected: entry.connected, ready: entry.ready, hand: [...entry.hand], isCpu: entry.isCpu })),
    };
    const interactionLocked = Boolean(game && isInteractionLockActive(game.interactionLock, now));
    return {
      hand: [...player.hand].sort((a, b) => a - b),
      availableActions: buildPrivateActions({
        roomStatus: room.status, phase: game?.phase ?? null, isHost: room.hostId === player.id,
        ready: player.ready, handCount: player.hand.length,
        connectedPlayerCount: Object.values(room.players).filter((entry) => entry.connected).length,
        canStartGame: room.status === 'lobby' && !game && Object.values(room.players).filter((entry) => entry.connected).length >= 2,
        interactionLocked, interactionLockReason: game?.interactionLock?.reason ?? null, stars: game?.stars ?? 0,
        hasStarProposal: Boolean(game?.starProposal), alreadyAcceptedStar: Boolean(game?.starProposal && Array.from(game.starProposal.acceptedBy).includes(player.id)),
        isStarProposalInitiator: game?.starProposal?.initiatorId === player.id,
        isRoundReadyParticipant: readyParticipants({ players: Object.values(room.players) }).some((entry) => entry.id === player.id),
        isActiveRoundParticipant: playParticipants({ players: Object.values(room.players) }).some((entry) => entry.id === player.id),
        canParticipateInStarConsensus: player.connected, inRoundReadyWindow: Boolean(game && (game.phase === 'focus' || game.phase === 'paused')),
        canRetry: Boolean(game && (game.phase === 'victory' || game.phase === 'game-over') && room.hostId === player.id),
        machineState, now,
      }),
    };
  }

  publicEnvelope(room: RuntimeRoom, serverTime = this.clock.now()): PublicRoomEnvelope { return { version: room.version, serverTime, publicState: this.publicState(room) }; }
  privateEnvelope(room: RuntimeRoom, player: ApplicationPlayer, serverTime = this.clock.now()): PrivatePlayerEnvelope { return { version: room.version, serverTime, privateState: this.privateState(room, player, serverTime) }; }
  snapshot(room: RuntimeRoom, player: ApplicationPlayer, serverTime = this.clock.now()): RoomSnapshot { return { version: room.version, serverTime, publicState: this.publicState(room), privateState: this.privateState(room, player, serverTime) }; }
}
