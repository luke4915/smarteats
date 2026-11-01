import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// Statistiche: il confronto tra due serate (di partenza le ultime due concluse) e la matrice del menu, nella sagra di prova con due serate
// già concluse (venerdì: 136 €, sabato: 280 €).
test.describe.configure({ mode: 'serial' });

test('sagra: confronto tra due serate, ora per ora e prodotto per prodotto', async ({ page }) => {
  const { stats } = seed();
  await login(page, stats.host, stats.admin);
  await page.getByRole('link', { name: 'Statistiche' }).first().click();
  await page.getByRole('tab', { name: 'Confronto serate' }).click();

  await expect(page.getByLabel('Di riferimento (A)')).toHaveValue(/\d+/);
  await expect(page.getByLabel('Di riferimento (A)').locator('option:checked')).toContainText('Venerdì');
  await expect(page.getByLabel('Confrontata (B)').locator('option:checked')).toContainText('Sabato');
  const incasso = page.locator('div', { has: page.getByText('Incasso', { exact: true }) }).filter({ hasText: /280,00/ }).first();
  await expect(incasso).toContainText('+105,9 %');                        // da 136 € a 280 €
  await expect(incasso).toContainText('prima 136,00');

  // i prodotti: il più cambiato è il panino (da 10 a 25 pezzi)
  const first = page.getByRole('listitem').filter({ hasText: 'Panino con salsiccia' }).first();
  await expect(first).toContainText('+150 %');
  await page.getByRole('tab', { name: 'Incasso', exact: true }).last().click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Panino con salsiccia' }).first()).toContainText('+150 %');
  await shot(page, 'stats-01-confronto');

  await page.getByRole('tab', { name: 'Tabella' }).click();
  await expect(page.getByRole('columnheader', { name: 'Sabato' })).toBeVisible();
  await page.getByRole('button', { name: 'Scambia A e B' }).click();
  await expect(page.getByLabel('Di riferimento (A)').locator('option:checked')).toContainText('Sabato');
  await expect(page.getByText('−').first()).toBeVisible();               // ora i numeri scendono

  // da telefono: niente scorrimento orizzontale
  await page.setViewportSize({ width: 390, height: 664 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(page, 'stats-02-confronto-telefono');
});

test('sagra: la matrice del menu divide i prodotti in quattro gruppi', async ({ page }) => {
  const { stats } = seed();
  await login(page, stats.host, stats.admin);
  await page.getByRole('link', { name: 'Statistiche' }).first().click();
  await page.getByRole('tab', { name: 'Menu', exact: true }).click();

  const group = (title) => page.locator('section', { has: page.getByRole('heading', { name: title }) });
  await expect(group('Punti di forza')).toContainText('Panino con salsiccia');
  await expect(group('Molto venduti, rendono poco')).toContainText('Acqua');
  await expect(group('Rendono bene, si vendono poco')).toContainText('Hamburger');
  await expect(page.getByText(/Senza i costi delle ricette non si può calcolare il margine/)).toBeVisible();
  await shot(page, 'stats-03-matrice-gruppi');

  await page.getByRole('tab', { name: 'Grafico' }).click();
  await expect(page.getByRole('img', { name: 'Prodotti per vendite e rendimento' })).toBeVisible();
  await shot(page, 'stats-04-matrice-grafico');
  await page.getByRole('tab', { name: 'Tabella' }).click();
  await expect(page.getByRole('row', { name: /Acqua/ })).toBeVisible();

  await page.getByLabel('Periodo').selectOption({ label: 'Venerdì · 2 ott' });          // una sola serata: stessi quattro prodotti o più
  await expect(page.getByRole('row').nth(1)).toBeVisible();
});
