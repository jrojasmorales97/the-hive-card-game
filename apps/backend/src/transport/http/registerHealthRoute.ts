import type { FastifyInstance } from 'fastify';

/** HTTP remains a minimal operational adapter; gameplay is exposed through Socket.IO. */
export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async () => ({ ok: true }));
}
