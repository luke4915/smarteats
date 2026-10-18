import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// L'editor della pianta: tavoli e separatori si spostano e si ridimensionano allo stesso modo, con le maniglie.
test('pianta: separatore tracciato, spostato e ridimensionato con le maniglie; tavolo ridimensionato', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: 'Sale e tavoli' }).click();
  await page.getByRole('button', { name: /Disegna pianta/ }).first().click();
  await expect(page.getByText('Pianta della sala')).toBeVisible();
  await shot(page, 'floorplan-01-editor');

  const larghezza = () => page.getByRole('group', { name: 'larghezza' }).locator('span').first();

  // ── Separatore: strumento, si traccia trascinando sulla griglia ──
  await page.getByRole('tab', { name: 'Separatore' }).click();
  const canvas = page.locator('div.relative.rounded-xl.border').first();
  const box = await canvas.boundingBox();
  const cell = box.width / 16;
  await page.mouse.move(box.x + cell * 6.5, box.y + cell * 7.5);
  await page.mouse.down();
  await page.mouse.move(box.x + cell * 10.5, box.y + cell * 7.5, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText('Separatore selezionato')).toBeVisible();      // appena tracciato è già selezionato
  await expect(page.getByRole('separator', { name: /Ridimensiona \(e\)/ })).toBeVisible();
  await expect(larghezza()).toHaveText('5');
  await shot(page, 'floorplan-02-separatore');

  // ── Maniglia a destra: si allunga di 2 celle ──
  const handle = page.getByRole('separator', { name: /Ridimensiona \(e\)/ });
  const hb = await handle.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + cell * 2, hb.y + hb.height / 2, { steps: 5 });
  await page.mouse.up();
  await expect(larghezza()).toHaveText('7');

  // ── Un tavolo si ridimensiona con le stesse maniglie ──
  await page.getByRole('button', { name: 'Tavolo T1' }).click();
  await expect(page.getByText('Tavolo selezionato')).toBeVisible();
  const before = Number(await larghezza().textContent());
  const th = await page.getByRole('separator', { name: /Ridimensiona \(e\)/ }).boundingBox();
  await page.mouse.move(th.x + th.width / 2, th.y + th.height / 2);
  await page.mouse.down();
  await page.mouse.move(th.x + th.width / 2 + cell, th.y + th.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(larghezza()).toHaveText(String(before + 1));
  await shot(page, 'floorplan-03-tavolo');

  // ── Salva e controlla sul server ──
  await page.locator('div.fixed').getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByText('Pianta salvata')).toBeVisible();
  const rooms = await page.evaluate(() => fetch('/api/rooms').then(res => res.json()));
  const el = rooms[0].elements[0];
  expect([el.kind, el.w, el.h]).toEqual(['divider', 7, 1]);
});
