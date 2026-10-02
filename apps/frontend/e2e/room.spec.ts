import { test, expect, action, play } from './fixtures';

test('create, join, host-only start, and leave migrate host', async ({ page, browser }) => {
  await page.goto('/'); await page.getByRole('tab', { name: 'Create room' }).click();
  await page.getByLabel('Name', { exact: true }).fill('Alice'); await action(page, 'Create room').click();
  await expect(action(page, 'Start')).toBeDisabled();
  const code = await page.evaluate(() => localStorage.getItem('th:lastRoomCode'));
  const context = await browser.newContext(); const other = await context.newPage(); await other.goto('/');
  await other.getByLabel('Name', { exact: true }).fill('Bob'); await other.getByLabel('Room code', { exact: true }).fill(code!);
  await action(other, 'Join').click(); await expect(other.getByText('Host starts the run.')).toBeVisible();
  await expect(action(page, 'Start')).toBeEnabled();
  await action(page, 'Leave room').click(); await page.locator('.btn-danger').click();
  await expect(action(other, 'Start')).toBeDisabled();
  await context.close();
});

test('unknown room displays an error', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('Name', { exact: true }).fill('Alice');
  await page.getByLabel('Room code', { exact: true }).fill('ZZZZZZ'); await action(page, 'Join').click();
  await expect(page.getByText('That room does not exist')).toBeVisible();
});

for (const [cpus, maxLevel, lives] of [[1, 12, 2], [2, 10, 3], [3, 8, 4], [4, 8, 4], [5, 7, 5], [6, 6, 5], [7, 5, 5]]) test(`CPUON${cpus} starts with the correct balance and seats`, async ({ page, request }) => {
  await page.goto('/'); await page.getByLabel('Name', { exact: true }).fill('Balance tester');
  await page.getByLabel('Room code', { exact: true }).fill(`CPUON${cpus}`); await action(page, 'Join').click();
  await action(page, 'Start').click(); await expect(action(page, 'Ready')).toBeEnabled();
  const code = await page.evaluate(() => localStorage.getItem('th:lastRoomCode'));
  const room = await (await request.get(`http://127.0.0.1:3003/rooms/${code}`)).json();
  expect(Object.keys(room.players)).toHaveLength(cpus + 1);
  expect(room.game.maxLevel).toBe(maxLevel); expect(room.game.lives).toBe(lives); expect(room.game.stars).toBe(1);
  await request.delete(`http://127.0.0.1:3003/rooms/${code}`);
});

test('two human browsers play consecutive levels and only host retries victory', async ({ page, browser, match }) => {
  await match.seed({ hands: [[10], [20]], phase: 'focus', level: 1, maxLevel: 2 }); await match.open(page);
  const context = await browser.newContext(); const other = await context.newPage(); await match.open(other, 1);
  for (let level = 1; level <= 2; level++) {
    await action(page, 'Ready').click(); await action(other, 'Ready').click();
    await expect(action(page, 'Pause')).toBeEnabled();
    for (let card = 0; card < level * 2; card++) {
      const players: any[] = Object.values((await match.state()).players);
      const index = players[0].hand.length && (!players[1].hand.length || players[0].hand[0] < players[1].hand[0]) ? 0 : 1;
      await play(index === 0 ? page : other);
    }
    if (level === 1) await expect.poll(async () => (await match.state()).game.currentLevel).toBe(2);
  }
  await expect(page.getByRole('heading', { name: 'YOU WON' })).toBeVisible();
  await expect(other.getByRole('heading', { name: 'YOU WON' })).toBeVisible();
  await expect(action(other, 'Retry')).toHaveCount(0); await action(page, 'Retry').click();
  await expect(action(other, 'Ready')).toBeEnabled(); await context.close();
});

test('CPUON7 full game: start, pause, both star outcomes, all levels, victory', async ({ page, request }) => {
  test.setTimeout(120_000);
  await page.goto('/'); await page.getByLabel('Name', { exact: true }).fill('CPU tester');
  await page.getByLabel('Room code', { exact: true }).fill('CPUON7'); await action(page, 'Join').click();
  const code = await page.evaluate(() => localStorage.getItem('th:lastRoomCode'));
  const state = async () => (await request.get(`http://127.0.0.1:3003/rooms/${code}`)).json();
  await action(page, 'Start').click(); await action(page, 'Ready').click();
  await expect(action(page, 'Pause')).toBeEnabled(); await action(page, 'Pause').click();
  await action(page, 'Ready').click(); await action(page, 'Propose star').click();
  await expect.poll(async () => (await state()).game.currentLevel).toBe(2);
  // Level 1 star consumes every remaining lowest card. Finish level 2 normally to earn another star.
  for (let level = 2; level <= 5; level++) {
    await action(page, 'Ready').click();
    if (level === 3) {
      await action(page, 'Propose star').click();
      await expect.poll(async () => (await state()).game.phase).toBe('paused');
      await action(page, 'Ready').click();
    }
    while (true) {
      const room = await state();
      if (room.game.currentLevel !== level || room.game.phase === 'victory') break;
      const human: any = Object.values(room.players).find((p: any) => !p.isCpu);
      if (!human.hand.length) break;
      await expect.poll(async () => {
        const current = await state();
        const minimum = Math.min(...Object.values(current.players).flatMap((p: any) => p.hand));
        return current.players[human.id].hand[0] === minimum;
      }).toBe(true);
      await play(page);
    }
    await expect.poll(async () => { const room = await state(); return room.game.phase === 'victory' || room.game.currentLevel > level; }).toBe(true);
  }
  await expect(page.getByRole('heading', { name: 'YOU WON' })).toBeVisible();
  expect((await state()).game.lives).toBe(5);
});
