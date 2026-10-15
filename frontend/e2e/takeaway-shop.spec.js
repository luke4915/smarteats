import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// Una pizzeria di solo asporto usa SmartEats con il solo necessario: asporto, cucina, carta, statistiche, impostazioni.
// Niente sala, tavoli né prenotazioni.
test('solo asporto: l\'app mostra solo ciò che serve e si lavora dall\'asporto', async ({ page }) => {
  const { shop } = seed();
  await login(page, shop.host, shop.admin);

  const nav = page.locator('aside nav');
  await expect(nav.getByRole('link', { name: 'Asporto' })).toBeVisible();
  for (const name of ['Cucina', 'Carta', 'Statistiche', 'Impostazioni']) await expect(nav.getByRole('link', { name })).toBeVisible();
  for (const name of ['Sala', 'Prenotazioni']) await expect(nav.getByRole('link', { name })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nuovo ordine' })).toBeVisible();      // si parte dall'asporto
  await shot(page, 'takeaway-shop-01-asporto');

  // Ordine al banco: due pizze, nome, si inserisce
  await page.getByRole('button', { name: 'Nuovo ordine' }).click();
  await page.getByRole('button', { name: /^Margherita/ }).first().click();
  await page.getByRole('button', { name: /^Margherita/ }).first().click();
  await page.getByLabel('Nome', { exact: true }).fill('Pizza da asporto');
  await page.getByRole('button', { name: /^Inserisci l'ordine/ }).click();
  await expect(page.getByText('Ordine inserito').first()).toBeVisible();

  // Carta semplice (niente portate né opzioni) e statistiche della cassa
  await nav.getByRole('link', { name: 'Carta' }).click();
  await expect(page.getByText('Margherita').first()).toBeVisible();
  await expect(page.getByText('Opzioni dei piatti')).toHaveCount(0);
  await nav.getByRole('link', { name: 'Statistiche' }).click();
  await expect(page.getByRole('heading', { name: 'Statistiche' })).toBeVisible();
  await shot(page, 'takeaway-shop-02-statistiche');
});
