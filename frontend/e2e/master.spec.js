import { test, expect } from '@playwright/test';
import { seed, shot, urlOf } from './support.js';

// La console del gestore: entra, crea un locale (ristorante), lo trova, lo allunga e lo elimina.
test('master: creo un locale, lo trovo, allungo la licenza e lo elimino', async ({ page }) => {
  const s = seed();
  const slug = `prova-${Date.now().toString(36)}`;
  await page.goto(`${urlOf(s.restaurant.host)}/master`);
  await page.getByLabel('Password master').fill(s.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await expect(page.getByRole('heading', { name: 'Console master' })).toBeVisible();
  await shot(page, 'master-01-elenco');

  await page.getByRole('button', { name: 'Nuovo locale' }).click();
  await page.getByPlaceholder('Es. Sagra del Calzone').fill(`Locale ${slug}`);
  await expect(page.getByPlaceholder('sagra-del-calzone')).toHaveValue(`locale-${slug}`);
  await page.getByPlaceholder('Es. admin').fill('titolare');
  await page.getByRole('button', { name: 'Genera una password' }).click();
  await shot(page, 'master-02-nuovo');
  await page.getByRole('button', { name: 'Crea il locale' }).click();

  await expect(page.getByRole('heading', { name: `Locale ${slug}` })).toBeVisible();
  await page.getByPlaceholder('Cerca un locale').fill(slug);
  const card = page.getByRole('article').filter({ hasText: `Locale ${slug}` });
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: 'Gestisci' }).click();
  await expect(page.getByRole('dialog', { name: `Locale ${slug}` })).toBeVisible();
  await shot(page, 'master-03-locale');
  await page.getByRole('button', { name: '+30 giorni' }).click();
  await page.getByRole('tab', { name: 'Moduli' }).click();
  await expect(page.getByRole('button', { name: 'Salva' })).toBeVisible();
  await shot(page, 'master-03b-moduli');
  await page.getByRole('tab', { name: 'Generale' }).click();
  await page.getByRole('button', { name: 'Elimina il locale' }).click();
  await page.getByPlaceholder(`locale-${slug}`).fill(`locale-${slug}`);
  await page.getByRole('button', { name: 'Elimina', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: `Locale ${slug}` })).toHaveCount(0);
});

// Avvisi WhatsApp: si configurano solo dal Master (eventi, tetto, prova); il locale vede solo lo stato.
test('master: avvisi WhatsApp di un locale — eventi, tetto, messaggio di prova', async ({ page }) => {
  const s = seed();
  await page.goto(`${urlOf(s.restaurant.host)}/master`);
  await page.getByLabel('Password master').fill(s.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await page.getByPlaceholder('Cerca un locale').fill(s.restaurant.host.split('.')[0]);
  const card = page.getByRole('article').first();
  await card.getByRole('button', { name: 'Gestisci' }).click();
  await page.getByRole('tab', { name: 'WhatsApp' }).click();

  await expect(page.getByText('Pratiche incluse al mese')).toBeVisible();
  await expect(page.getByText('Prenotazione confermata', { exact: true })).toBeVisible();
  await expect(page.getByText('Ordine ritirato', { exact: true })).toBeVisible();
  await page.getByLabel('Ordine ritirato').check();                                 // spento di partenza
  await page.getByLabel('Pratiche incluse al mese').fill('120');
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Salvato')).toBeVisible();
  await shot(page, 'master-04-whatsapp');

  await page.getByPlaceholder('Cellulare, es. 333 1234567').fill('333 123 4567');
  await page.getByRole('button', { name: 'Invia prova' }).click();
  await expect(page.getByText(/Prova inviata \(mock\)/)).toBeVisible();
});
