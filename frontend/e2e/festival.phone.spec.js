import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// La cassa della sagra da telefono: categorie a chip, barra fissa in basso, carrello a tutto schermo.
test('sagra da telefono: chip categoria, aggiungo, barra in basso, carrello, invio', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await expect(page.getByRole('tab', { name: 'Bevande' })).toBeVisible();
  await shot(page, 'phone-01-prodotti');

  await page.getByRole('tab', { name: 'Bevande' }).click();
  await expect(page.getByRole('button', { name: /^Birra/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Panino con salsiccia/ })).toHaveCount(0);

  const birra = page.locator('button.product-card', { hasText: 'Birra' });
  await birra.click();
  await birra.click();
  await shot(page, 'phone-02-con-articoli');
  const bar = page.getByRole('button', { name: /2 articoli/ });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('8.00 €');

  await bar.click();
  await expect(page.getByRole('heading', { name: 'Ordine' })).toBeVisible();
  await shot(page, 'phone-03-carrello');
  await page.getByRole('button', { name: /Una in più: Birra/ }).click();
  await expect(page.getByText('12.00 €').filter({ visible: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /Invia ordine/ }).click();
  await expect(page.getByRole('button', { name: /Apri la cassa/ })).toBeVisible({ timeout: 10_000 });   // carrello svuotato
  await shot(page, 'phone-04-dopo-invio');
});
