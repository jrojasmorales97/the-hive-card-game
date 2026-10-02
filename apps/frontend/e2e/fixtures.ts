import { test as base, expect, type Page } from '@playwright/test';
import { randomBytes } from 'node:crypto';

export type Seed = { hands: number[][]; cpu?: boolean; phase?: 'playing' | 'focus' | 'paused'; level?: number; maxLevel?: number; lives?: number; stars?: number; lobby?: boolean; disconnected?: number[] };
export const test = base.extend<{ match: { seed: (input: Seed) => Promise<void>; open: (page: Page, index?: number) => Promise<void>; state: () => Promise<any>; code: string } }>({
  match: async ({ request }, use) => {
    const code = randomBytes(3).toString('hex').toUpperCase();
    let players: { id: string; name: string }[] = [];
    await use({ code,
      seed: async input => {
        const response = await request.post('http://127.0.0.1:3003/rooms', { data: { code, ...input } });
        expect(response.ok()).toBeTruthy();
        players = (await response.json()).players;
      },
      open: async (page, index = 0) => {
        await page.addInitScript(({ player, code }) => {
          localStorage.setItem('th:playerId', player.id);
          localStorage.setItem('th:playerName', player.name);
          localStorage.setItem('th:lastRoomCode', code);
        }, { player: players[index], code });
        await page.goto('/');
        await expect(page.getByRole('button', { name: 'Leave room', exact: true })).toBeVisible();
      },
      state: async () => (await request.get(`http://127.0.0.1:3003/rooms/${code}`)).json(),
    });
    await request.delete(`http://127.0.0.1:3003/rooms/${code}`);
  },
});
export { expect };
export const action = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
export async function play(page: Page) { await page.getByTitle('Play this card', { exact: true }).click(); }
