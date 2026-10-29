import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

// Lo schermo della cucina pubblico (`/kds`, senza login): la cassa batte un ordine in modalità avanzata e il tabellone lo mostra con il
// codice, i pezzi e il riepilogo «Da preparare»; quando la cucina lo segna pronto sparisce.
test('KDS pubblico: l\'ordine compare con codice e pezzi e sparisce quando è pronto', async ({ page, browser }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await page.getByRole('link', { name: 'Impostazioni' }).click();
  const advanced = page.getByRole('switch', { name: 'Ordini avanzati' });
  if (await advanced.getAttribute('aria-checked') !== 'true') await advanced.click();
  await page.getByRole('link', { name: 'Cassa' }).click();
  await page.getByRole('button', { name: /^Panino con salsiccia/ }).click();
  await page.getByRole('button', { name: /^Panino con salsiccia/ }).click();
  await page.getByRole('button', { name: /^Birra/ }).click();
  await page.getByRole('button', { name: /Invia ordine/i }).click();

  const kds = await (await browser.newContext({ viewport: { width: 1280, height: 800 }, ignoreHTTPSErrors: true })).newPage();
  await kds.goto(`${urlOf(festival.host)}/kds`);
  await expect(kds.getByRole('heading', { name: 'Cucina' })).toBeVisible();
  const ticket = kds.getByRole('article').filter({ hasText: 'Panino con salsiccia' });
  await expect(ticket).toBeVisible({ timeout: 10_000 });
  await expect(ticket).toContainText('2');
  await expect(kds.getByRole('region', { name: 'Da preparare' })).toContainText('Birra');
  await shot(kds, 'kds-01-tabellone');

  await page.getByRole('link', { name: 'Cucina' }).click();
  await page.getByRole('button', { name: 'Pronta', exact: true }).first().click();
  await expect(kds.getByRole('article').filter({ hasText: 'Panino con salsiccia' })).toHaveCount(0, { timeout: 10_000 });
  await shot(kds, 'kds-02-vuoto');
});
