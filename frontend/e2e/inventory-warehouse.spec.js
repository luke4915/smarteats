import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

// Magazzino, fase 2: il master sceglie la modalità «magazzino»; l'admin crea ingredienti e la ricetta di un piatto; la cucina trova «Esaurito».
test('magazzino: ingredienti e ricetta di un piatto; la cucina può segnare esaurito', async ({ page, browser }) => {
  const s = seed();
  const slug = s.restaurant.host.split('.')[0];
  const openModules = async () => {
    await page.goto(`${urlOf(s.restaurant.host)}/master`);
    await page.getByLabel('Password master').fill(s.password);
    await page.getByRole('button', { name: 'Entra' }).click();
    await page.getByPlaceholder('Cerca un locale').fill(slug);
    await page.getByRole('article').first().getByRole('button', { name: 'Gestisci' }).click();
    await page.getByRole('tab', { name: 'Moduli' }).click();
  };

  await openModules();
  await page.getByLabel('Magazzino e scorte').check();
  await page.getByRole('tab', { name: 'Magazzino', exact: true }).click();
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Salvato')).toBeVisible();

  const admin = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  await login(admin, s.restaurant.host, s.restaurant.admin);
  await admin.getByRole('link', { name: 'Magazzino' }).click();
  await expect(admin.getByRole('heading', { name: 'Magazzino' })).toBeVisible();

  // ingredienti
  for (const name of ['Farina 00', 'Mozzarella']) {
    await admin.getByRole('button', { name: 'Nuovo ingrediente' }).click();
    await admin.getByPlaceholder('Es. Farina 00').fill(name);
    await admin.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(admin.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await shot(admin, 'inventory-03-ingredienti');

  // ricetta di un piatto
  await admin.getByRole('tab', { name: 'Ricette' }).click();
  await admin.getByRole('button', { name: /^Bruschetta/ }).click();
  await expect(admin.getByRole('dialog', { name: /Ricetta · Bruschetta/ })).toBeVisible();
  await admin.getByRole('button', { name: 'Aggiungi' }).click();
  await admin.getByLabel('Ingrediente').selectOption({ label: 'Farina 00' });
  await admin.getByLabel('Quantità', { exact: true }).fill('200');
  await shot(admin, 'inventory-04-ricetta');
  await admin.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(admin.getByRole('button', { name: /Bruschetta.*1 ingrediente/ })).toBeVisible();

  // la cucina vede «Esaurito»
  const chef = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  await login(chef, s.restaurant.host, s.restaurant.kitchen);
  await chef.getByRole('button', { name: 'Segna esaurito' }).click();
  await expect(chef.getByRole('dialog', { name: 'Esaurito' })).toBeVisible();
  await expect(chef.getByRole('switch', { name: 'Bruschetta: disponibile' })).toBeChecked();
  await shot(chef, 'inventory-05-esaurito');
  await chef.close();
  await admin.close();

  // si rimette com'era
  await openModules();
  await page.getByLabel('Magazzino e scorte').uncheck();
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Salvato')).toBeVisible();
});
