import { test } from '@playwright/test';
import { seed, login, shot } from './support.js';
test('giro schermate', async ({ page }) => {
  const s = seed();
  await login(page, s.ristorante.host, s.ristorante.admin);
  for (const p of ['carta', 'statistiche', 'impostazioni']) {
    await page.locator(`a[href="/${p}"]`).first().click(); await page.waitForTimeout(1500); await shot(page, `zz-r-${p}`);
  }
  await page.context().clearCookies();
  await login(page, s.sagra.host, s.sagra.admin);
  for (const [i, n] of [[1, 'kitchen'], [2, 'statistics'], [3, 'config'], [4, 'setup']]) {
    await page.locator('nav button').nth(i).click(); await page.waitForTimeout(1500); await shot(page, `zz-s-${n}`);
  }
});
