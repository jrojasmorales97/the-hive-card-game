import { io, type Socket } from 'socket.io-client';
import { resetServerForTests, startServer, stopServer } from './index.js';

const TIMEOUT_MS = 2_000;

export type TestClient = Socket;

let integrationServer: { url: string; port: number } | null = null;

export async function startIntegrationServer() {
  if (integrationServer) {
    resetServerForTests();
    return integrationServer;
  }
  resetServerForTests();
  integrationServer = await startServer({ port: 0, host: '127.0.0.1', random: seededRandom(1), timingScale: 0.01 });
  return integrationServer;
}

export function createClient(url: string): Promise<TestClient> {
  const client = io(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  return waitForEvent(client, 'connect').then(() => client);
}

export function emitWithAck<T>(client: TestClient, event: string, payload?: unknown): Promise<T> {
  const emission = payload === undefined ? client.timeout(TIMEOUT_MS).emitWithAck(event) : client.timeout(TIMEOUT_MS).emitWithAck(event, payload);
  return emission as Promise<T>;
}

export function waitForEvent<T>(client: TestClient, event: string, predicate: (payload: T) => boolean = () => true): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      client.off(event, listener);
      reject(new Error(`Timed out waiting for ${event}`));
    }, TIMEOUT_MS);
    const listener = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      client.off(event, listener);
      resolve(payload);
    };
    client.on(event, listener);
  });
}

export async function closeIntegration(clients: TestClient[]): Promise<void> {
  clients.forEach((client) => client.disconnect());
  await new Promise((resolve) => setTimeout(resolve, 10));
  resetServerForTests();
}

export async function stopIntegrationServer(): Promise<void> {
  if (!integrationServer) return;
  await stopServer();
  integrationServer = null;
}

export function seededRandom(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x1_0000_0000;
  };
}
