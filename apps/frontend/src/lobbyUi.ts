export type LobbyPlayer = {
  id: string;
  name: string;
  connected: boolean;
  isCpu?: boolean;
};

export function buildLobbySeats<T>(players: T[], seatCount: number): Array<T | null> {
  return Array.from({ length: seatCount }, (_, index) => players[index] ?? null);
}

export function shouldShowTopbarRoomCode(roomStatus: 'lobby' | 'in-game'): boolean {
  return roomStatus !== 'lobby';
}

export function waitingRoomMessage(input: { isHost: boolean; hostName: string | null | undefined }): string {
  if (input.isHost) {
    return 'Share the code and start when ready.';
  }

  return `Waiting for ${input.hostName ?? 'the host'} to start.`;
}
