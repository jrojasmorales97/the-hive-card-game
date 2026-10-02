import type { ApplicationRoom } from '../../application/model.js';
import type { RandomSource } from '../../application/ports/randomSource.js';
import type { RoomRepository } from '../../application/ports/roomRepository.js';

const MAX_CPU_PLAYERS = 7;

export type CpuRoomAccessDependencies = {
  rooms: RoomRepository;
  random: RandomSource;
  onRoomCreated?: (roomCode: string, cpuPlayers: number) => void;
};

/** Development-only room access adapter. It materializes CPU rooms without leaking that mode into Socket.IO handlers. */
export class CpuRoomAccess {
  constructor(private readonly dependencies: CpuRoomAccessDependencies) {}

  resolveJoinRoom(requestedRoomCode: string, playerId: string): { roomCode: string } | { error: string } {
    const room = this.dependencies.rooms.get(requestedRoomCode);
    if (!room) {
      const cpuPlayers = parseCpuRoomCode(requestedRoomCode);
      if (!cpuPlayers) return { error: 'That room does not exist' };
      const roomCode = this.createUniqueRoomCode();
      this.createRoom(roomCode, cpuPlayers, requestedRoomCode);
      return { roomCode };
    }
    if (room.shareable === false && !room.players[playerId]) return { error: 'This private room cannot be shared' };
    return { roomCode: room.code };
  }

  private createUniqueRoomCode(): string {
    let code = this.generateRoomCode();
    while (this.dependencies.rooms.has(code)) code = this.generateRoomCode();
    return code;
  }

  private generateRoomCode(length = 6): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let index = 0; index < length; index += 1) code += chars[Math.floor(this.dependencies.random.next() * chars.length)];
    return code;
  }

  private createRoom(roomCode: string, cpuPlayers: number, displayCode: string): void {
    const players: ApplicationRoom['players'] = {};
    for (let index = 1; index <= cpuPlayers; index += 1) {
      const id = `${roomCode.toLowerCase()}-cpu-${String(index).padStart(2, '0')}`;
      players[id] = { id, name: `CPU ${index}`, connected: true, ready: true, hand: [], isCpu: true };
    }
    this.dependencies.rooms.save({
      code: roomCode,
      displayCode,
      shareable: false,
      hostId: Object.keys(players)[0],
      status: 'lobby',
      players,
      game: null,
      version: 0,
      logs: [],
    }, 0);
    this.dependencies.onRoomCreated?.(roomCode, cpuPlayers);
  }
}

export function parseCpuRoomCode(roomCode: string): number | null {
  const match = /^CPUON([1-7])$/.exec(roomCode);
  return match ? Math.min(MAX_CPU_PLAYERS, Math.max(1, Number(match[1]))) : null;
}
