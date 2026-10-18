import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// L'editor dei prodotti nelle due versioni: la carta del ristorante (elenco compatto, portata, opzioni) e il listino
// della sagra (elenco per categoria). Stesso modulo e stesse regole: nome unico, quantità valida.
test('carta del ristorante: aggiungo un piatto con portata, provo un doppione, lo modifico, lo nascondo, lo elimino', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Carta' }).click();
  await expect(page.getByText('Spaghetti alle vongole')).toBeVisible();

  await page.getByRole('button', { name: 'Nuovo piatto' }).click();
  await page.locator('input[name="category"]').fill('Primi');
  await page.locator('input[name="name"]').fill('Risotto di prova');
  await page.locator('input[name="price"]').fill('12,5');
  await page.getByLabel('Portata').selectOption({ label: 'Primi' });
  await shot(page, 'catalog-01-modulo');
  await page.getByRole('button', { name: 'Aggiungi prodotto' }).click();
  await expect(page.getByRole('button', { name: 'Modifica Risotto di prova' })).toBeVisible();
  await expect(page.getByText('12,50 €')).toBeVisible();

  // Lo stesso nome nella stessa categoria non si può creare
  await page.getByRole('button', { name: 'Nuovo piatto' }).click();
  await page.locator('input[name="category"]').fill('Primi');
  await page.locator('input[name="name"]').fill('Risotto di prova');
  await page.locator('input[name="price"]').fill('9');
  await page.getByRole('button', { name: 'Aggiungi prodotto' }).click();
  await expect(page.getByText('Prodotto già esistente')).toBeVisible();
  await page.getByRole('button', { name: 'Ho capito' }).click();
  await page.getByRole('button', { name: 'Chiudi', exact: true }).click();

  // Modifica del prezzo
  await page.getByRole('button', { name: 'Modifica Risotto di prova' }).click();
  await page.locator('input[name="price"]').fill('14');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByText('14,00 €')).toBeVisible();

  // Nascosto sparisce dall'elenco finché non si chiede di vederlo
  await page.getByRole('button', { name: 'Nascondi Risotto di prova' }).click();
  await expect(page.getByRole('button', { name: 'Modifica Risotto di prova' })).toHaveCount(0);
  await page.getByRole('button', { name: /Mostra anche i \d+ piatti nascosti/ }).click();
  await expect(page.getByRole('button', { name: 'Modifica Risotto di prova' })).toBeVisible();

  await page.getByRole('button', { name: 'Elimina Risotto di prova' }).click();
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Modifica Risotto di prova' })).toHaveCount(0);
});

test('listino della sagra: aggiungo un prodotto con disponibilità limitata e lo elimino', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await page.goto(`${page.url().split('/').slice(0, 3).join('/')}/config`);
  await expect(page.getByText('Panino con salsiccia')).toBeVisible();
  await shot(page, 'catalog-02-listino-sagra');

  await page.getByRole('button', { name: 'Aggiungi' }).click();
  await page.locator('input[name="category"]').fill('Panini');
  await page.locator('input[name="name"]').fill('Panino di prova');
  await page.locator('input[name="price"]').fill('6');
  await page.getByLabel('Disponibilità limitata').check();
  // Senza una quantità il salvataggio resta bloccato
  await expect(page.getByRole('button', { name: 'Aggiungi prodotto' })).toBeDisabled();
  await page.locator('input[name="stock"]').fill('10');
  await page.getByRole('button', { name: 'Aggiungi prodotto' }).click();
  await expect(page.getByRole('button', { name: 'Elimina Panino di prova' })).toBeVisible();

  await page.getByRole('button', { name: 'Elimina Panino di prova' }).click();
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Elimina Panino di prova' })).toHaveCount(0);
});
