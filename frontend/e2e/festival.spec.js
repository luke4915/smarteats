import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// La cassa della sagra su schermo grande (PC o tablet in orizzontale): carta a sinistra, carrello a destra.
test('sagra: batto un ordine con due prodotti, lo invio, lo storno non serve: il carrello si svuota', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await expect(page.getByRole('button', { name: /Panino con salsiccia/ })).toBeVisible();
  await shot(page, 'festival-01-cassa');

  await page.getByRole('button', { name: /Panino con salsiccia/ }).click();
  await page.getByRole('button', { name: /Panino con salsiccia/ }).click();
  await page.getByRole('button', { name: /^Birra/ }).click();
  await shot(page, 'festival-02-carrello');
  // 2 × 5,00 + 4,00
  await expect(page.getByText('14.00 €').first()).toBeVisible();

  await page.getByRole('button', { name: /Invia ordine/i }).click();
  await expect(page.getByText(/Ordine .* inviato|inviato/i).first()).toBeVisible({ timeout: 10_000 });
  await shot(page, 'festival-03-inviato');
});

test('sagra: in modalità avanzata l\'ordine va in cucina e lo chef lo segna pronto', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await page.getByRole('link', { name: 'Sistema' }).click();
  await page.getByRole('switch', { name: 'Ordini avanzati' }).click();
  await page.getByRole('link', { name: 'Cassa' }).click();
  await page.getByRole('button', { name: /Panino con salsiccia/ }).click();
  await page.getByRole('button', { name: /Invia ordine/i }).click();
  await page.getByRole('link', { name: 'Cucina' }).click();
  await expect(page.getByRole('heading', { name: 'Cucina' })).toBeVisible();
  await expect(page).toHaveTitle(/^Cucina · /);                          // la scheda del browser dice dove sei
  await expect(page.getByRole('article').getByText(/Panino con salsiccia/)).toBeVisible({ timeout: 10_000 });
  await shot(page, 'festival-04-cucina');
  await page.getByRole('button', { name: 'Pronta', exact: true }).click();
  await expect(page.getByText('Tutto in pari')).toBeVisible({ timeout: 10_000 });
});

test('sagra: Sistema ha un menu di sezioni, una alla volta', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await page.getByRole('link', { name: 'Sistema' }).click();
  await expect(page.getByRole('switch', { name: 'Tema scuro' })).toBeVisible();
  await shot(page, 'festival-05-sistema');
  const nav = page.getByRole('navigation', { name: 'Sezioni delle impostazioni' });
  await nav.getByRole('button', { name: 'Personale' }).click();
  await expect(page.getByRole('switch', { name: 'Tema scuro' })).toHaveCount(0);
  await nav.getByRole('button', { name: 'Stampa' }).click();
  await expect(page).toHaveURL(/sezione=printing/);
  await shot(page, 'festival-06-stampa');
});
