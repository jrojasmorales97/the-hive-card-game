import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@the-hive/contracts';
import { registerHealthRoute } from './registerHealthRoute.js';

export type HttpSocketTransport = {
  app: FastifyInstance;
  io: Server<ClientToServerEvents, ServerToClientEvents>;
};

/** Creates framework adapters without composing application or infrastructure dependencies. */
export async function createHttpSocketTransport(clientOrigin: string): Promise<HttpSocketTransport> {
  const allowAllOrigins = clientOrigin.trim() === '*';
  const app = Fastify({ logger: true });
  await app.register(cors, {
    origin: allowAllOrigins ? true : clientOrigin,
    credentials: !allowAllOrigins,
  });
  registerHealthRoute(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(app.server, {
    cors: {
      origin: allowAllOrigins ? true : clientOrigin,
      methods: ['GET', 'POST'],
      credentials: !allowAllOrigins,
    },
  });
  return { app, io };
}
