import test from 'node:test';
import assert from 'node:assert/strict';

import { connectionIcon, connectionLabel, deriveConnectionState } from './connectionStatus.js';

test('deriveConnectionState returns disconnected or reconnecting when socket is down', () => {
  assert.equal(
    deriveConnectionState({ socketConnected: false, reconnecting: false, hasRoom: true, syncInFlight: false, syncHealthy: false }),
    'disconnected',
  );
  assert.equal(
    deriveConnectionState({ socketConnected: false, reconnecting: true, hasRoom: true, syncInFlight: false, syncHealthy: false }),
    'reconnecting',
  );
});

test('deriveConnectionState only returns syncing when room state is not healthy yet', () => {
  assert.equal(
    deriveConnectionState({ socketConnected: true, reconnecting: false, hasRoom: true, syncInFlight: true, syncHealthy: true }),
    'connected',
  );
  assert.equal(
    deriveConnectionState({ socketConnected: true, reconnecting: false, hasRoom: true, syncInFlight: true, syncHealthy: false }),
    'syncing',
  );
  assert.equal(
    deriveConnectionState({ socketConnected: true, reconnecting: false, hasRoom: true, syncInFlight: false, syncHealthy: false }),
    'syncing',
  );
});

test('deriveConnectionState returns connected when socket and room sync are healthy', () => {
  assert.equal(
    deriveConnectionState({ socketConnected: true, reconnecting: false, hasRoom: true, syncInFlight: false, syncHealthy: true }),
    'connected',
  );
  assert.equal(
    deriveConnectionState({ socketConnected: true, reconnecting: false, hasRoom: false, syncInFlight: false, syncHealthy: false }),
    'connected',
  );
});

test('label and icon expose the extra syncing state', () => {
  assert.equal(connectionLabel('syncing'), 'Sync');
  assert.equal(connectionIcon('syncing'), 'sync');
});
