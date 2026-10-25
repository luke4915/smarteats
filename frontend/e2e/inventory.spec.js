import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

// Magazzino, fase 1: il master accende il modulo e sceglie la modalità; l'admin del locale trova le porzioni nel prodotto.
test('magazzino: il master lo accende, la carta mostra le porzioni; poi lo spegne', async ({ page, browser }) => {
  const s = seed();
  const slug = s.restaurant.host.split('.')[0];

  const openModules = async () => {
    await page.goto(`${urlOf(s.restaurant.host)}/master`);
    await page.getByLabel('Password master').fill(s.password);
    await page.getByRole('button', { name: 'Entra' }).click();
    await page.getByPlaceholder('Cerca un locale').fill(slug);
    await page.getByRole('article').first().getByRole('button', { name: 'Gestisci' }).click();
    await page.getByRole('tab', { name: 'Moduli' }).click();
  };

  // 1. il master accende «Magazzino e scorte» e sceglie la modalità
  await openModules();
  await page.getByLabel('Magazzino e scorte').check();
  await page.getByRole('tab', { name: 'Magazzino', exact: true }).click();
  await expect(page.getByText('Come si scalano gli ingredienti')).toBeVisible();
  await page.getByRole('tab', { name: 'Porzioni', exact: true }).click();
  await expect(page.getByText('Come si scalano gli ingredienti')).toHaveCount(0);
  await shot(page, 'inventory-01-master');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Salvato')).toBeVisible();

  // 2. l'admin del locale trova le porzioni nel prodotto
  const admin = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  await login(admin, s.restaurant.host, s.restaurant.admin);
  await admin.goto(`${urlOf(s.restaurant.host)}/catalog`);
  await admin.getByRole('button', { name: /Nuovo piatto/ }).click();
  await expect(admin.getByRole('tablist', { name: 'Regola delle porzioni' })).toBeVisible();
  await admin.getByRole('tab', { name: 'Da N a ogni servizio' }).click();
  await expect(admin.getByLabel('Porzioni di partenza')).toBeVisible();
  await shot(admin, 'inventory-02-porzioni');
  await admin.close();

  // 3. si rimette com'era (gli altri test non contano sul magazzino)
  await openModules();
  await page.getByLabel('Magazzino e scorte').uncheck();
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Salvato')).toBeVisible();
});
