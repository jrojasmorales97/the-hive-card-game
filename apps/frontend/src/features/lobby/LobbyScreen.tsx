import type { PublicRoomState } from '@the-hive/contracts';
import { buildLobbySeats, waitingRoomMessage } from '../../lobbyUi.js';
import { MainBrandMark, RulesPanels } from '../../shared/ui/index.js';

type LobbyScreenProps = {
  room: PublicRoomState;
  playerId: string;
  canStart: boolean;
  playerColors: ReadonlyMap<string, string>;
  onStart: () => void;
  onRequestLeave: () => void;
  onCopyRoomLink: () => void;
};

export function LobbyScreen({ room, playerId, canStart, playerColors, onStart, onRequestLeave, onCopyRoomLink }: LobbyScreenProps) {
  const isHost = room.hostId === playerId;
  const hostPlayer = room.players.find((player) => player.id === room.hostId) ?? null;
  const seats = buildLobbySeats(room.players, 8);
  return <div className="lobby-scroll room-waiting-scroll"><div className="room-waiting-stack"><MainBrandMark className="waiting-room-brand" /><section className="panel waiting-room-panel"><div className="waiting-room-shell"><div className="lobby-pill-row"><button className="topbar-pill topbar-exit-pill" onClick={onRequestLeave} title="Leave room" aria-label="Leave room"><span className="material-symbols-rounded" aria-hidden>logout</span>Exit</button><button className={`topbar-pill room-pill${room.shareable === false ? ' is-private' : ''}`} onClick={onCopyRoomLink} disabled={room.shareable === false} title={room.shareable === false ? 'Private CPU room' : 'Copy room code'}><span className="topbar-pill-label">{room.displayCode ?? room.code}</span><span className="material-symbols-rounded" aria-hidden>{room.shareable === false ? 'lock' : 'content_copy'}</span></button></div><div className="waiting-room-copy compact"><p className="waiting-room-eyebrow">Room lobby</p><p className="waiting-room-copy-line">{waitingRoomMessage({ isHost, hostName: hostPlayer?.name })}</p></div><div className="waiting-hive-grid" aria-label="Players in room">{seats.map((player, index) => {
    if (!player) return <article key={`empty-seat-${index}`} className="waiting-player-card is-empty" aria-hidden><div className="waiting-player-cell"><span className="material-symbols-rounded waiting-player-icon" aria-hidden>add</span></div></article>;
    const color = playerColors.get(player.id);
    return <article key={player.id} className={`waiting-player-card${player.id === room.hostId ? ' is-host' : ''}${!player.connected ? ' is-disconnected' : ''}`} style={{ '--player-border-color': color ?? undefined } as React.CSSProperties}><div className="waiting-player-cell"><span className="material-symbols-rounded waiting-player-icon" aria-hidden>person</span><div className="waiting-player-body"><strong className={`waiting-player-name${player.name.length > 12 ? ' compact' : ''}${player.name.length > 18 ? ' tiny' : ''}`} style={{ color }}>{player.name}</strong><div className="waiting-player-head">{player.isCpu && <span className="waiting-player-badge cpu">CPU</span>}</div>{!player.connected && <span className="waiting-player-status">Reconnecting</span>}</div></div></article>;
  })}</div><div className="waiting-room-footer">{isHost ? <button className="command-button waiting-room-start" onClick={onStart} disabled={!canStart}>Start</button> : <p className="waiting-room-footnote">Host starts the run.</p>}</div></div></section><RulesPanels /></div></div>;
}
