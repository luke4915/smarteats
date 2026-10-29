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
  await expect(page.getByRole('button', { name: /^Panino con salsiccia/ })).toHaveCount(0);

  const birra = page.getByRole('button', { name: /^Birra/ });          // la tessera (il «−» ha un altro nome)
  await birra.click();
  await birra.click();
  await shot(page, 'phone-02-con-articoli');
  const bar = page.getByRole('button', { name: /2 articoli/ });
  await expect(bar).toBeVisible();
  await expect(bar).toContainText('8,00 €');

  await bar.click();
  await expect(page.getByRole('heading', { name: 'Ordine' })).toBeVisible();
  await shot(page, 'phone-03-carrello');
  // In fondo al carrello c'è tutto, anche con i margini dell'iPhone: «Svuota» e «Storno ordini» si vedono sempre
  await expect(page.getByRole('button', { name: 'Storno ordini' })).toBeInViewport();
  await expect(page.getByRole('button', { name: 'Svuota' })).toBeInViewport();
  // I tagli dei contanti si sommano (20 e poi 5 fanno 25) e la X azzera
  await page.getByRole('button', { name: 'Aggiungi 20 €' }).click();
  await page.getByRole('button', { name: 'Aggiungi 5 €' }).click();
  await expect(page.getByRole('textbox', { name: 'Ricevuti' })).toHaveValue('25');
  await page.getByRole('button', { name: 'Azzera i contanti ricevuti' }).click();
  await expect(page.getByRole('textbox', { name: 'Ricevuti' })).toHaveValue('');
  await page.getByRole('button', { name: /Una in più: Birra/ }).click();
  await expect(page.getByText('12,00 €').filter({ visible: true }).first()).toBeVisible();

  await page.getByRole('button', { name: /Invia ordine/ }).click();
  await expect(page.getByRole('button', { name: /Apri la cassa/ })).toBeVisible({ timeout: 10_000 });   // carrello svuotato
  await shot(page, 'phone-04-dopo-invio');
});
