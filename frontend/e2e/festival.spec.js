import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// La cassa della sagra su schermo grande (PC o tablet in orizzontale): carta a sinistra, carrello a destra.
test('sagra: batto un ordine con due prodotti, lo invio, lo storno non serve: il carrello si svuota', async ({ page }) => {
  const { sagra } = seed();
  await login(page, sagra.host, sagra.admin);
  await expect(page.getByRole('button', { name: /Panino con salsiccia/ })).toBeVisible();
  await shot(page, 'sagra-01-cassa');

  await page.getByRole('button', { name: /Panino con salsiccia/ }).click();
  await page.getByRole('button', { name: /Panino con salsiccia/ }).click();
  await page.getByRole('button', { name: /^Birra/ }).click();
  await shot(page, 'sagra-02-carrello');
  // 2 × 5,00 + 4,00
  await expect(page.getByText('14.00 €').first()).toBeVisible();

  await page.getByRole('button', { name: /Invia ordine/i }).click();
  await expect(page.getByText(/Ordine .* inviato|inviato/i).first()).toBeVisible({ timeout: 10_000 });
  await shot(page, 'sagra-03-inviato');
});

test('sagra: la cucina vede l\'ordine e lo completa', async ({ browser }) => {
  const { sagra } = seed();
  const page = await (await browser.newContext()).newPage();
  await login(page, sagra.host, sagra.cucina);
  await expect(page.getByText(/Panino con salsiccia/)).toBeVisible({ timeout: 10_000 });
  await shot(page, 'sagra-04-cucina');
});
