export type ConnectionState = 'connected' | 'syncing' | 'reconnecting' | 'disconnected';

export const RESYNC_INTERVAL_MS = 5000;
export const RESYNC_TIMEOUT_MS = 2500;

export function deriveConnectionState(input: {
  socketConnected: boolean;
  reconnecting: boolean;
  hasRoom: boolean;
  syncInFlight: boolean;
  syncHealthy: boolean;
}): ConnectionState {
  if (!input.socketConnected) return input.reconnecting ? 'reconnecting' : 'disconnected';
  // Background resyncs should stay visually quiet while the last confirmed game snapshot is still healthy.
  if (input.hasRoom && !input.syncHealthy) return 'syncing';
  return 'connected';
}

export function connectionLabel(state: ConnectionState): string {
  return (
    {
      connected: 'Ok',
      syncing: 'Sync',
      reconnecting: 'Retry',
      disconnected: 'Off',
    }[state] ?? state
  );
}

export function connectionIcon(state: ConnectionState): string {
  return (
    {
      connected: 'wifi',
      syncing: 'sync',
      reconnecting: 'wifi_find',
      disconnected: 'wifi_off',
    }[state] ?? 'wifi_off'
  );
}
