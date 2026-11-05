import { test, expect } from '@playwright/test';
import { seed, shot, urlOf } from './support.js';

// Il costruttore degli scontrini (solo master): scrivo nome e testo legale, l'anteprima delle copie li mostra, salvo,
// riapro e li ritrovo; infine rimetto i valori predefiniti.
test('master: costruttore degli scontrini — anteprima in diretta, salvataggio, ripristino', async ({ page }) => {
  const s = seed();
  const host = s.restaurant.host.split('.')[0];
  const open = async () => {
    await page.getByPlaceholder('Cerca un locale').fill(host);
    await page.getByRole('article').first().getByRole('button', { name: 'Gestisci' }).click();
    await page.getByRole('button', { name: "Apri l'editor" }).click();
    await expect(page.getByText('Ordine di esempio')).toBeVisible();
  };
  await page.goto(`${urlOf(s.restaurant.host)}/master`);
  await page.getByLabel('Password master').fill(s.password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await open();

  const name = page.getByPlaceholder('Es. Pro Loco di Esempio');
  await name.fill('Trattoria Prova Scontrini');
  await page.getByLabel('Testo legale').fill('Raccolta fondi occasionale');
  // ogni copia ha la sua anteprima (la prima è il numeretto, senza intestazione); il testo legale compare dove c'è il totale
  await page.getByRole('tab', { name: 'Cliente' }).click();
  await expect(page.locator('pre').filter({ hasText: 'Trattoria Prova Scontrini' }).first()).toBeVisible();
  await shot(page, 'receipt-01-editor');
  await expect(page.locator('pre').filter({ hasText: 'Raccolta fondi occasionale' }).first()).toBeVisible();
  await expect(page.locator('pre').filter({ hasText: 'TOTALE' }).first()).toBeVisible();
  await shot(page, 'receipt-02-cliente');

  // la carta stretta (58 mm): le righe si accorciano a 32 lettere, il testo non esce dalla scheda
  await page.getByRole('tab', { name: '58 mm' }).click();
  const slip = page.locator('pre').filter({ hasText: 'TOTALE' }).first();
  await expect(slip).toContainText('-'.repeat(32));
  await expect(slip).not.toContainText('-'.repeat(33));
  await shot(page, 'receipt-03-58mm');
  await page.getByRole('tab', { name: '80 mm' }).click();
  await expect(page.locator('pre').filter({ hasText: 'TOTALE' }).first()).toContainText('-'.repeat(42));

  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByText('Salvato')).toBeVisible();

  // riaperto, i valori ci sono
  await page.getByRole('button', { name: 'Chiudi' }).click();
  await page.reload();
  await page.getByLabel('Password master').fill(s.password).catch(() => {});
  if (await page.getByRole('button', { name: 'Entra' }).isVisible().catch(() => false)) await page.getByRole('button', { name: 'Entra' }).click();
  await open();
  await expect(name).toHaveValue('Trattoria Prova Scontrini');

  // ripristino: i campi vuoti tornano al predefinito
  await name.fill('');
  await page.getByLabel('Testo legale').fill('');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.getByText('Salvato')).toBeVisible();
});
