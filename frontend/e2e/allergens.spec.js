import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

// Allergeni e lingue: l'amministratore dichiara gli allergeni di un prodotto, il cliente li vede nel menu (dal telefono), segna quelli da evitare
// e può leggere tutto nella sua lingua.
test('sagra: allergeni dichiarati, segnalati a chi li evita e letti in inglese', async ({ page, browser }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await page.getByRole('link', { name: 'Menu', exact: true }).first().click();
  await page.getByRole('button', { name: 'Modifica Panino con salsiccia' }).click();
  const group = page.getByRole('group', { name: 'Allergeni' });
  await group.getByRole('button', { name: 'Cereali contenenti glutine' }).click();
  await group.getByRole('button', { name: 'Latte' }).click();
  await page.getByLabel('Nome in inglese').fill('Sausage sandwich');
  await shot(page, 'allergens-01-editor');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByText(/Allergeni: cereali contenenti glutine, latte/)).toBeVisible();      // anche nella riga dell'elenco

  // il cliente, da telefono
  const phone = await browser.newContext({ viewport: { width: 390, height: 664 }, locale: 'it-IT', ignoreHTTPSErrors: true });
  const client = await phone.newPage();
  await client.goto(`${urlOf(festival.host)}/menu`);
  await client.getByRole('tab', { name: 'Panini' }).click();
  await expect(client.getByText('Contiene: Cereali contenenti glutine, Latte')).toBeVisible();
  await expect(client.getByText(/informazioni sugli allergeni sono fornite dal locale/)).toBeVisible();

  await client.getByRole('button', { name: 'Allergie' }).click();
  const dialog = client.getByRole('dialog', { name: 'Cosa devi evitare?' });
  await dialog.getByLabel('Latte').check();
  await shot(client, 'allergens-02-filtro');
  await dialog.getByRole('button', { name: 'Fatto' }).click();
  await expect(client.getByText('⚠ Contiene Latte')).toBeVisible();                               // segnalato, non nascosto
  await expect(client.getByRole('button', { name: 'Allergie: 1' })).toBeVisible();

  // la scelta resta dopo un ricaricamento, e il menu si legge in inglese
  await client.reload();
  await client.getByRole('tab', { name: 'Panini' }).click();
  await expect(client.getByText('⚠ Contiene Latte')).toBeVisible();
  await client.getByLabel('Lingua').selectOption('en');
  await expect(client.getByText('⚠ Contains Milk')).toBeVisible();
  await expect(client.getByPlaceholder(/Search/)).toHaveCount(0);                                  // con pochi prodotti la ricerca non c'è
  await expect(client.getByText('Sausage sandwich')).toBeVisible();                              // il nome nella lingua del cliente
  await client.getByRole('button', { name: 'Add Sausage sandwich' }).click();
  await expect(client.getByRole('button', { name: /Show the QR code/ })).toBeVisible();
  await expect(client.getByRole('button', { name: /Switch to (dark|light) mode/ })).toBeVisible();
  expect(await client.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await shot(client, 'allergens-03-inglese');
  await phone.close();

  // si rimette a posto il locale di prova
  await page.evaluate(async () => {
    const products = await (await fetch('/api/products')).json();
    const p = products.find(x => x.name === 'Panino con salsiccia');
    await fetch(`/api/products/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: p.name, price: Number(p.price), category: p.category, color: p.color, visible: true, print_destination: p.print_destination, allergens: [], translations: {} }) });
  });
});
