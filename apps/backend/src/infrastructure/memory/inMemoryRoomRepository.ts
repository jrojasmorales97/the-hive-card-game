import type { RoomRepository } from '../../application/ports/roomRepository.js';
import type { ApplicationRoom } from '../../application/model.js';

const clone = <T>(value: T): T => structuredClone(value);

/** Process-local repository with room and player indices. */
export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, ApplicationRoom>();
  private readonly playerRooms = new Map<string, string>();
  get(roomCode: string): ApplicationRoom | undefined { const room = this.rooms.get(roomCode); return room && clone(room); }
  /** Runtime publishers append bounded logs after commit; application never receives this mutable reference. */
  current(roomCode: string): ApplicationRoom | undefined { return this.rooms.get(roomCode); }
  roomCodes(): IterableIterator<string> { return this.rooms.keys(); }
  clear(): void { this.rooms.clear(); this.playerRooms.clear(); }
  findRoomCodeByPlayer(playerId: string): string | undefined { return this.playerRooms.get(playerId); }
  has(roomCode: string): boolean { return this.rooms.has(roomCode); }
  save(room: ApplicationRoom, expectedVersion: number): ApplicationRoom {
    const current = this.rooms.get(room.code);
    if (current && current.version !== expectedVersion) throw new Error('Room version conflict');
    const next = clone({ ...room, version: current ? current.version + 1 : room.version });
    this.rooms.set(next.code, next);
    for (const playerId of Object.keys(next.players)) this.playerRooms.set(playerId, next.code);
    return clone(next);
  }
  delete(roomCode: string): void {
    const room = this.rooms.get(roomCode);
    if (room) for (const playerId of Object.keys(room.players)) this.playerRooms.delete(playerId);
    this.rooms.delete(roomCode);
  }
}
