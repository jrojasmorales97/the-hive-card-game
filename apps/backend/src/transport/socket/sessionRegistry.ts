/** Transport-only active binding guard. A replaced socket cannot disconnect the newer session. */
export class SessionRegistry {
  private readonly bySocket = new Map<string, { playerId: string; roomCode: string }>();
  private readonly byPlayer = new Map<string, string>();
  bind(socketId: string, playerId: string, roomCode: string): string | undefined {
    const previous = this.byPlayer.get(playerId);
    if (previous) this.bySocket.delete(previous);
    this.bySocket.set(socketId, { playerId, roomCode });
    this.byPlayer.set(playerId, socketId);
    return previous;
  }
  context(socketId: string): { playerId: string; roomCode: string } | undefined { const entry = this.bySocket.get(socketId); return entry && { ...entry }; }
  socketIdForPlayer(playerId: string): string | undefined { return this.byPlayer.get(playerId); }
  isActive(socketId: string, playerId: string): boolean { return this.byPlayer.get(playerId) === socketId && this.bySocket.get(socketId)?.playerId === playerId; }
  unbindIfActive(socketId: string): { playerId: string; roomCode: string } | undefined {
    const entry = this.bySocket.get(socketId);
    if (!entry || !this.isActive(socketId, entry.playerId)) return undefined;
    this.bySocket.delete(socketId); this.byPlayer.delete(entry.playerId);
    return entry;
  }
  removePlayer(playerId: string): void { const socketId = this.byPlayer.get(playerId); if (socketId) this.bySocket.delete(socketId); this.byPlayer.delete(playerId); }
  clear(): void { this.bySocket.clear(); this.byPlayer.clear(); }
}
