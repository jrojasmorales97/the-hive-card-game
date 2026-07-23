import type { ApplicationRoom } from '../model.js';

/** A save increments the functional version once; appending a bounded log does not. */
export interface RoomRepository {
  get(roomCode: string): ApplicationRoom | undefined;
  findRoomCodeByPlayer(playerId: string): string | undefined;
  has(roomCode: string): boolean;
  save(room: ApplicationRoom, expectedVersion: number): ApplicationRoom;
  delete(roomCode: string): void;
}
