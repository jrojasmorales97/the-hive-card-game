import { MainBrandMark, RulesPanels } from '../../shared/ui/index.js';

type RoomAccessScreenProps = {
  playerName: string;
  roomCode: string;
  accessTab: 'create' | 'join';
  busy: boolean;
  onPlayerNameChange: (value: string) => void;
  onRoomCodeChange: (value: string) => void;
  onAccessTabChange: (tab: 'create' | 'join') => void;
  onCreate: () => void;
  onJoin: () => void;
};

export function RoomAccessScreen(props: RoomAccessScreenProps) {
  return <div className="lobby-scroll"><div className="hero"><div className="hero-inner"><MainBrandMark heading /><p className="hero-tagline">No talking | No signaling | In order</p></div></div><section className="panel lobby-panel"><div className="tabs-row" role="tablist" aria-label="Room access"><button role="tab" aria-selected={props.accessTab === 'join'} className={`tab-btn ${props.accessTab === 'join' ? 'active' : ''}`} onClick={() => props.onAccessTabChange('join')}>Join room</button><button role="tab" aria-selected={props.accessTab === 'create'} className={`tab-btn ${props.accessTab === 'create' ? 'active' : ''}`} onClick={() => props.onAccessTabChange('create')}>Create room</button></div>{props.accessTab === 'create' && <form className="lobby-grid" onSubmit={(event) => { event.preventDefault(); props.onCreate(); }}><label>Name<input value={props.playerName} onChange={(event) => props.onPlayerNameChange(event.target.value)} placeholder="Your name" /></label><div className="actions align-right"><button type="submit" disabled={props.busy}>Create room</button></div></form>}{props.accessTab === 'join' && <form className="lobby-grid" onSubmit={(event) => { event.preventDefault(); props.onJoin(); }}><label>Name<input value={props.playerName} onChange={(event) => props.onPlayerNameChange(event.target.value)} placeholder="Your name" /></label><label>Room code<input value={props.roomCode} onChange={(event) => props.onRoomCodeChange(event.target.value.toUpperCase())} placeholder="ABC123" /></label><div className="actions align-right"><button type="submit" disabled={props.busy}>Join</button></div></form>}</section><RulesPanels /></div>;
}
