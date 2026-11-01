import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// PIN personale: l'amministratore lo imposta dall'elenco utenti; chi è collegato blocca lo schermo e lo sblocca con il PIN (o la password),
// i puntini sono tanti quanti le cifre del PIN (e all'ultima cifra si conferma da soli), i tentativi sbagliati si contano fino al blocco, e un collega di cassa si dà il cambio con il suo PIN sulla stessa cassa.
test.describe.configure({ mode: 'serial' });

const ADMIN_PIN = '739104';       // admin e responsabile: sempre 6 cifre
const CASHIER_PIN = '4826';

const tap = async (page, digits) => { for (const d of digits) await page.getByRole('button', { name: d, exact: true }).click(); };
const rowOf = (page, name) => page.getByRole('listitem').filter({ hasText: name }).first();

async function setPin(page, name, pin) {
  await rowOf(page, name).getByRole('button', { name: /(Imposta|Cambia) PIN/ }).click();
  await page.getByLabel(/^Nuovo PIN/).fill(pin);
  await page.getByLabel('Ripeti il PIN').fill(pin);
  await page.getByRole('button', { name: 'Salva PIN' }).click();
  await expect(rowOf(page, name).getByText('PIN', { exact: true })).toBeVisible();
}

test('ristorante: PIN impostato, schermo bloccato e sbloccato, tentativi, cambio utente', async ({ page, context }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Impostazioni' }).first().click();
  await page.getByRole('tablist', { name: 'Sezioni delle impostazioni' }).getByRole('tab', { name: 'Account' }).click();

  // Un PIN banale lo rifiuta il server; poi si imposta quello dell'amministratore e quello della cassa
  await rowOf(page, r.cashier).getByRole('button', { name: 'Imposta PIN' }).click();
  await page.getByLabel(/^Nuovo PIN/).fill('1234');
  await page.getByLabel('Ripeti il PIN').fill('1234');
  await page.getByRole('button', { name: 'Salva PIN' }).click();
  await expect(page.getByText(/troppo semplice|facile/i).first()).toBeVisible();
  await page.getByRole('button', { name: 'Annulla' }).click();
  await setPin(page, r.cashier, CASHIER_PIN);
  await setPin(page, r.admin, ADMIN_PIN);
  await shot(page, 'pin-01-utenti');

  // Blocca schermo dal menu dell'account; il PIN sbagliato dice quanti tentativi restano
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('button', { name: 'Blocca schermo' }).click();
  const lock = page.getByRole('dialog', { name: 'Schermo bloccato' });
  await expect(lock).toBeVisible();
  const dots = lock.locator('[role=img] > span');
  await expect(dots).toHaveCount(6);      // il PIN dell'amministratore ha 6 cifre: sei puntini, non quattro
  await tap(page, '000000');
  await expect(lock.getByRole('alert')).toContainText('PIN errato (4 tentativi prima del blocco)');
  await shot(page, 'pin-02-blocco');

  // Ricaricando la pagina lo schermo resta bloccato; il PIN giusto lo apre
  await page.reload();
  await expect(lock).toBeVisible();
  await tap(page, ADMIN_PIN);
  await expect(lock).toBeHidden();

  // Cambio utente: la cassa entra con il suo PIN e ha i permessi della cassa
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('button', { name: 'Blocca schermo' }).click();
  await lock.getByRole('button', { name: 'Cambia utente' }).click();
  await expect(lock.getByRole('heading', { name: 'Chi sei?' })).toBeVisible();
  await expect(lock.getByRole('button', { name: new RegExp(r.admin) })).toHaveCount(0);      // chi ha bloccato non compare tra i colleghi
  await shot(page, 'pin-03-cambio-utente');
  await lock.getByRole('button', { name: new RegExp(r.cashier) }).click();
  await expect(lock.locator('[role=img] > span')).toHaveCount(4);      // il PIN della cassa ha 4 cifre
  await tap(page, CASHIER_PIN);
  await expect(lock).toBeHidden();
  await expect(page.getByRole('button', { name: `Account: ${r.cashier}` })).toBeVisible();

  // Cinque PIN sbagliati bloccano i tentativi, ma la password sblocca sempre
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('button', { name: 'Blocca schermo' }).click();
  for (let i = 0; i < 5; i++) { await tap(page, '0000'); await page.waitForTimeout(150); }
  await expect(lock.getByRole('alert')).toContainText('Troppi tentativi');
  await lock.getByRole('button', { name: 'Usa la password' }).click();
  await lock.getByLabel('Password').fill(seed().password);
  await lock.getByRole('button', { name: 'Sblocca' }).click();
  await expect(lock).toBeHidden();

  // Si rimettono a posto i PIN del locale di prova
  await context.clearCookies();
  await page.evaluate(() => localStorage.clear());
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Impostazioni' }).first().click();
  await page.getByRole('tablist', { name: 'Sezioni delle impostazioni' }).getByRole('tab', { name: 'Account' }).click();
  for (const name of [r.cashier, r.admin]) {
    await rowOf(page, name).getByRole('button', { name: 'Cambia PIN' }).click();
    await page.getByRole('button', { name: 'Togli PIN' }).click();
    await expect(rowOf(page, name).getByText('PIN', { exact: true })).toHaveCount(0);
  }
});

test('telefono: la schermata di blocco sta nello schermo, in verticale e in orizzontale', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Impostazioni' }).first().click();
  await page.getByRole('tablist', { name: 'Sezioni delle impostazioni' }).getByRole('tab', { name: 'Account' }).click();
  await setPin(page, r.admin, ADMIN_PIN);
  await page.getByRole('button', { name: /^Account:/ }).click();
  await page.getByRole('button', { name: 'Blocca schermo' }).click();
  const lock = page.getByRole('dialog', { name: 'Schermo bloccato' });
  for (const [w, h, name] of [[390, 664, 'verticale'], [740, 360, 'orizzontale']]) {
    await page.setViewportSize({ width: w, height: h });
    await expect(lock.getByRole('button', { name: '9', exact: true })).toBeVisible();
    await shot(page, `pin-04-telefono-${name}`);
    // L'ultima riga di tasti si raggiunge anche se la schermata scorre
    await lock.getByRole('button', { name: '0', exact: true }).scrollIntoViewIfNeeded();
    await expect(lock.getByRole('button', { name: '0', exact: true })).toBeInViewport();
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await tap(page, ADMIN_PIN);
  await expect(lock).toBeHidden();
  await rowOf(page, r.admin).getByRole('button', { name: 'Cambia PIN' }).click();
  await page.getByRole('button', { name: 'Togli PIN' }).click();
  await expect(rowOf(page, r.admin).getByText('PIN', { exact: true })).toHaveCount(0);
});
