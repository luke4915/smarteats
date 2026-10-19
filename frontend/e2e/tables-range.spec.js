import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// I tavoli hanno un intervallo di posti: l'admin imposta il minimo, e la Sala lo mostra («4–6»).
test('tavoli: imposto da 4 a 6 posti e la Sala lo mostra', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: 'Sale e tavoli' }).click();
  await page.getByRole('button', { name: 'Modifica T4' }).click();
  await page.getByLabel('Posti minimi').fill('4');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByText('4–6').first()).toBeVisible();
  await shot(page, 'tables-range-01-impostazioni');

  await page.getByRole('link', { name: 'Sala' }).click();
  await expect(page.getByRole('button', { name: /^T4: Libero/ })).toContainText('4–6');
  await shot(page, 'tables-range-02-sala');

  // ripristino: minimo vuoto = tavolo fisso come prima (gli altri test contano su 6 posti)
  await page.getByRole('link', { name: 'Impostazioni' }).click();
  await page.getByRole('button', { name: 'Sale e tavoli' }).click();
  await page.getByRole('button', { name: 'Modifica T4' }).click();
  await page.getByLabel('Posti minimi').fill('6');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByText('4–6')).toHaveCount(0);
});
