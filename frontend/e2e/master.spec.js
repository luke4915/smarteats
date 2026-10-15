import { test, expect } from '@playwright/test';
import { seed, shot, urlOf } from './support.js';

// La console del gestore: entra, crea un locale (ristorante), lo trova, lo allunga e lo elimina.
test('master: creo un locale, lo trovo, allungo la licenza e lo elimino', async ({ page }) => {
  const s = seed();
  const slug = `prova-${Date.now().toString(36)}`;
  await page.goto(`${urlOf(s.ristorante.host)}/master`);
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
  await card.getByRole('button', { name: '+30 giorni' }).click();
  await shot(page, 'master-03-locale');

  await card.getByRole('button', { name: 'Elimina' }).click();
  await page.getByPlaceholder(`locale-${slug}`).fill(`locale-${slug}`);
  await page.getByRole('button', { name: 'Elimina', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: `Locale ${slug}` })).toHaveCount(0);
});
