import { test, expect, action, play } from './fixtures';

test('background resync never rejoins or mutates a healthy room', async ({ page, match }) => {
  await page.clock.install();
  await match.seed({ hands: [[10], [20]], phase: 'focus' }); await match.open(page);
  const before = await match.state();
  await page.clock.runFor(5100);
  expect((await match.state()).version).toBe(before.version);
  expect((await match.state()).logs).toEqual(before.logs);
  await action(page, 'Ready').click();
  expect((await match.state()).players[`${match.code}-player-0`].ready).toBe(true);
});

test('reconnecting during countdown preserves its pending transition', async ({ page, match }) => {
  await match.seed({ hands: [[90], [10, 20]], cpu: true, phase: 'focus' });
  await match.open(page); await action(page, 'Ready').click(); await page.reload();
  await expect.poll(async () => (await match.state()).game.pile).toEqual([10, 20]);
  await expect(action(page, 'Pause')).toBeEnabled();
});

test('reconnecting while next-level lock is active still unlocks ready', async ({ page, match }) => {
  await match.seed({ hands: [[10], []], level: 1 }); await match.open(page); await play(page);
  await expect.poll(async () => (await match.state()).game.currentLevel).toBe(2);
  await page.reload(); await expect(action(page, 'Ready')).toBeEnabled();
  await action(page, 'Ready').click();
  expect((await match.state()).players[`${match.code}-player-0`].ready).toBe(true);
});

test('CPU takes the next minimum after human play', async ({ page, match }) => {
  await match.seed({ hands: [[10, 90], [20, 80]], cpu: true });
  await match.open(page); await play(page);
  await expect.poll(async () => (await match.state()).game.pile).toEqual([10, 20, 80]);
  await expect(page.getByTitle('Play this card')).toContainText('90');
});

test('CPU starts after focus countdown', async ({ page, match }) => {
  await match.seed({ hands: [[90], [10, 20]], cpu: true, phase: 'focus' });
  await match.open(page); await action(page, 'Ready').click();
  await expect.poll(async () => (await match.state()).game.pile).toEqual([10, 20]);
  await expect(action(page, 'Pause')).toBeEnabled();
});

test('pause and ready resume CPU play', async ({ page, match }) => {
  await match.seed({ hands: [[90], [10, 20]], cpu: true });
  await match.open(page); await action(page, 'Pause').click();
  await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
  await expect(page.getByTitle('Play this card')).toBeDisabled();
  await action(page, 'Ready').click();
  await expect.poll(async () => (await match.state()).game.pile).toEqual([10, 20]);
});

test('correct last card advances level and unlocks ready', async ({ page, match }) => {
  await match.seed({ hands: [[10], []], cpu: true, level: 1 });
  await match.open(page); await play(page);
  await expect.poll(async () => (await match.state()).game.currentLevel).toBe(2);
  await expect(action(page, 'Ready')).toBeEnabled();
  expect(Object.values((await match.state()).players).map((p: any) => p.hand.length)).toEqual([2, 2]);
});

for (const endsRound of [false, true]) test(`star consumption ${endsRound ? 'ends level' : 'pauses remaining hands'}`, async ({ page, match }) => {
  await match.seed({ hands: endsRound ? [[10], [20]] : [[10, 80], [20, 90]], cpu: true, level: 1 });
  await match.open(page); await action(page, 'Propose star').click();
  await expect.poll(async () => (await match.state()).game.stars).toBe(0);
  if (endsRound) {
    await expect.poll(async () => (await match.state()).game.currentLevel).toBe(2);
  } else {
    await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
    expect(Object.values((await match.state()).players).map((p: any) => p.hand)).toEqual([[80], [90]]);
  }
  await expect(action(page, 'Ready')).toBeEnabled();
  await action(page, 'Ready').click();
  await expect(action(page, 'Pause')).toBeEnabled();
});

test('error discards all blocking cards and loses exactly one life', async ({ page, match }) => {
  await match.seed({ hands: [[50, 80], [10, 20, 90]], cpu: true });
  await match.open(page); await play(page);
  await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
  const state = await match.state();
  expect(state.game.lives).toBe(2);
  expect(Object.values(state.players).map((p: any) => p.hand)).toEqual([[80], [90]]);
  await expect(action(page, 'Ready')).toBeEnabled();
});

test('error exhausting hands completes the level', async ({ page, match }) => {
  await match.seed({ hands: [[50], [10, 20]], level: 1 });
  await match.open(page); await play(page);
  await expect.poll(async () => (await match.state()).game.currentLevel).toBe(2);
  expect((await match.state()).game.lives).toBe(2);
  await expect(action(page, 'Ready')).toBeEnabled();
});

for (const victory of [false, true]) test(`${victory ? 'victory' : 'defeat'} shows ranking and host can retry`, async ({ page, match }) => {
  await match.seed({ hands: victory ? [[50], []] : [[50], [10]], level: 1, maxLevel: victory ? 1 : 5, lives: 1 });
  await match.open(page); await play(page);
  await expect(page.getByRole('heading', { name: victory ? 'YOU WON' : 'YOU LOST' })).toBeVisible();
  await expect(page.getByLabel('Final synchronization ranking')).toBeVisible();
  await action(page, 'Retry').click();
  await expect(action(page, 'Ready')).toBeEnabled();
  expect((await match.state()).game.currentLevel).toBe(1);
});

for (const [level, lives, stars, expectedLives, expectedStars] of [[2, 3, 1, 3, 2], [3, 3, 1, 4, 1], [2, 5, 3, 5, 3], [3, 5, 3, 5, 3]]) test(`reward level ${level}, lives ${lives}, stars ${stars}`, async ({ page, match }) => {
  await match.seed({ hands: [[10], []], level, lives, stars });
  await match.open(page); await play(page);
  await expect.poll(async () => (await match.state()).game.currentLevel).toBe(level + 1);
  const state = await match.state(); expect(state.game.lives).toBe(expectedLives); expect(state.game.stars).toBe(expectedStars);
  await expect(action(page, 'Ready')).toBeEnabled();
});

test('empty hand cannot pause or play and does not block ready quorum', async ({ page, browser, match }) => {
  await match.seed({ hands: [[], [20]], phase: 'paused' });
  await match.open(page);
  await expect(page.getByText('No card', { exact: true })).toBeVisible();
  await expect(action(page, 'Ready')).toHaveCount(0);
  const context = await browser.newContext(); const other = await context.newPage();
  await match.open(other, 1); await action(other, 'Ready').click();
  await expect.poll(async () => (await match.state()).game.phase).toBe('playing');
  await context.close();
});

test('reload reconnects the same player and preserves private hand', async ({ page, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]] });
  await match.open(page); await page.reload();
  await expect(page.getByTitle('Play this card')).toContainText('10');
  await play(page);
  await expect.poll(async () => (await match.state()).game.pile).toEqual([10]);
  expect(Object.keys((await match.state()).players)).toHaveLength(2);
});

test('zero stars disables proposal', async ({ page, match }) => {
  await match.seed({ hands: [[10], [20]], stars: 0 }); await match.open(page);
  await expect(action(page, 'Propose star')).toBeDisabled();
});

test('log opens and closes; leaving confirmation can be cancelled then accepted', async ({ page, match }) => {
  await match.seed({ hands: [[10], [20]] }); await match.open(page);
  await page.getByLabel('Center pile. Open game log').click();
  await expect(page.getByLabel('Game log', { exact: true })).toHaveClass(/open/);
  await page.getByLabel('Close game log').click();
  await action(page, 'Leave room').click();
  await page.locator('.btn-secondary').click();
  await expect(page.getByTitle('Play this card')).toBeVisible();
  await action(page, 'Leave room').click(); await page.locator('.btn-danger').click();
  await expect(page.getByRole('tab', { name: 'Join room' })).toBeVisible();
});

for (const decision of ['Accept star', 'Reject star', 'Retirar propuesta']) test(`human star consensus: ${decision}`, async ({ page, browser, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]] }); await match.open(page);
  const context = await browser.newContext(); const other = await context.newPage(); await match.open(other, 1);
  await action(page, 'Propose star').click();
  await expect(action(other, 'Accept star')).toBeVisible();
  await action(decision === 'Retirar propuesta' ? page : other, decision).click();
  if (decision === 'Accept star') {
    await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
    expect((await match.state()).game.stars).toBe(0);
    await expect(action(page, 'Ready')).toBeEnabled();
  } else {
    await expect(action(page, 'Propose star')).toBeEnabled();
    expect((await match.state()).game.stars).toBe(1);
  }
  await context.close();
});

test('empty connected hand still votes for star', async ({ page, browser, match }) => {
  await match.seed({ hands: [[10, 80], []] }); await match.open(page);
  const context = await browser.newContext(); const other = await context.newPage(); await match.open(other, 1);
  await action(page, 'Propose star').click(); await expect(action(other, 'Accept star')).toBeEnabled();
  expect((await match.state()).game.stars).toBe(1);
  await action(other, 'Accept star').click();
  await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
  await context.close();
});

test('star also discards disconnected hands without waiting for their vote', async ({ page, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]], disconnected: [1] }); await match.open(page);
  await action(page, 'Propose star').click();
  await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
  expect(Object.values((await match.state()).players).map((p: any) => p.hand)).toEqual([[80], [90]]);
});

test('CPU finishes after an error empties the only human hand', async ({ page, match }) => {
  await match.seed({ hands: [[50], [10, 90]], cpu: true, level: 1 }); await match.open(page); await play(page);
  await expect.poll(async () => (await match.state()).game.currentLevel).toBe(2);
  await expect(action(page, 'Ready')).toBeEnabled();
});

test('CPU finishes after star empties the only human hand', async ({ page, match }) => {
  await match.seed({ hands: [[10], [20, 90]], cpu: true, level: 1 }); await match.open(page);
  await action(page, 'Propose star').click();
  await expect.poll(async () => (await match.state()).game.currentLevel).toBe(2);
  await expect(action(page, 'Ready')).toBeEnabled();
});

test('reload during star settlement does not freeze or consume twice', async ({ page, match }) => {
  await match.seed({ hands: [[10, 80], [20, 90]], cpu: true }); await match.open(page);
  await action(page, 'Propose star').click(); await page.reload();
  await expect.poll(async () => (await match.state()).game.phase).toBe('paused');
  expect((await match.state()).game.stars).toBe(0);
  expect(Object.values((await match.state()).players).map((p: any) => p.hand)).toEqual([[80], [90]]);
  // A disconnect can leave only ready CPUs and begin countdown before rejoin.
  await expect(action(page, 'Ready').or(action(page, 'Pause'))).toBeEnabled();
  if (await action(page, 'Ready').isVisible()) await action(page, 'Ready').click();
  await expect(page.getByTitle('Play this card')).toBeEnabled();
});

test('reload during error penalty releases the lock', async ({ page, match }) => {
  await match.seed({ hands: [[50, 80], [10, 90]] }); await match.open(page); await play(page); await page.reload();
  await expect(action(page, 'Ready')).toBeEnabled();
  expect((await match.state()).game.phase).toBe('paused'); expect((await match.state()).game.lives).toBe(2);
});

test('mobile can pause, resume, use star and play its remaining card', async ({ page, match }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await match.seed({ hands: [[10, 80], [20, 90]], cpu: true, level: 1 }); await match.open(page);
  await action(page, 'Pause').click(); await action(page, 'Ready').click();
  await action(page, 'Propose star').click(); await action(page, 'Ready').click(); await play(page);
  await expect.poll(async () => (await match.state()).game.currentLevel).toBe(2);
});
