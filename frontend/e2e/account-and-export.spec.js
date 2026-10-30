import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// Impostazioni e uscite dei dati: nel ristorante le stampanti, il profilo dentro l'elenco utenti, i suggerimenti dal menu dell'account e il
// blocco dei dati riservati (si spegne solo con la password); nella sagra il menu pubblico con il QR e l'esportazione di una serata.
test.describe.configure({ mode: 'serial' });

test('ristorante: stampanti, profilo, suggerimenti e blocco dei dati con la password', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Impostazioni' }).first().click();
  const nav = page.getByRole('tablist', { name: 'Sezioni delle impostazioni' });

  // Stampanti: cucina, bar e conto; si scrive l'indirizzo e si accende
  await nav.getByRole('tab', { name: 'Stampanti' }).click();
  const address = page.getByLabel('Indirizzo della stampante: Comanda cucina');
  await address.fill('192.168.1.50');
  await address.blur();
  const switchKitchen = page.getByRole('switch', { name: 'Comanda cucina: stampa attiva' });
  await expect(switchKitchen).toBeEnabled();
  await switchKitchen.click();
  await expect(switchKitchen).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', { name: /Stampa di prova/ })).toBeVisible();
  await shot(page, 'settings-01-stampanti');
  // Il locale di prova è condiviso con gli altri test: la stampante si rispegne, altrimenti le comande proverebbero a stampare
  await switchKitchen.click();
  await expect(switchKitchen).toHaveAttribute('aria-checked', 'false');
  await address.fill('');
  await address.blur();
  await expect(switchKitchen).toBeDisabled();

  // Account: il proprio profilo si apre nella propria riga dell'elenco utenti
  await nav.getByRole('tab', { name: 'Account' }).click();
  await page.getByRole('button', { name: 'Il mio profilo' }).click();
  await expect(page.getByRole('button', { name: 'Cambia password' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salva username' })).toBeVisible();
  await shot(page, 'settings-02-profilo');

  // Dati riservati: si accende con un tocco, si spegne solo con la password
  await nav.getByRole('tab', { name: 'Dati riservati' }).click();
  const lock = page.getByRole('switch', { name: 'Blocca i dati riservati' });
  if (await lock.getAttribute('aria-checked') !== 'true') await lock.click();
  await expect(lock).toHaveAttribute('aria-checked', 'true');
  await lock.click();
  await expect(page.getByRole('heading', { name: 'Togliere il blocco?' })).toBeVisible();
  await page.getByLabel('La tua password').fill('password-sbagliata');
  await page.getByRole('button', { name: 'Togli il blocco' }).click();
  await expect(page.getByRole('alert')).toContainText(/non corretta/i);
  await shot(page, 'settings-03-blocco-password');
  await page.getByLabel('La tua password').fill(seed().password);
  await page.getByRole('button', { name: 'Togli il blocco' }).click();
  await expect(lock).toHaveAttribute('aria-checked', 'false');

  // Suggerimenti: dal menu dell'account, in una finestra
  await page.getByRole('button', { name: /^Account/ }).click();
  await page.getByRole('button', { name: 'Suggerimenti' }).click();
  await expect(page.getByRole('heading', { name: 'Dicci cosa migliorare' })).toBeVisible();
  await page.getByPlaceholder('Scrivi qui…').fill('Prova del test nel browser: tutto bene.');
  await shot(page, 'settings-04-suggerimenti');
  await page.getByRole('button', { name: 'Invia' }).click();
  await expect(page.getByText('Grazie! Il tuo feedback è arrivato')).toBeVisible();
});

test('sagra: menu pubblico con il QR e esportazione di una serata in PDF e CSV', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);

  await page.getByRole('link', { name: 'Impostazioni' }).first().click();
  await page.getByRole('tablist', { name: 'Sezioni delle impostazioni' }).getByRole('tab', { name: 'Menu pubblico' }).click();
  await expect(page.getByRole('button', { name: /Copia il link/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Scarica/ })).toBeVisible();
  await expect(page.getByText(/chiedilo all'assistenza/)).toBeVisible();          // il messaggio non si scrive qui
  await shot(page, 'festival-07-menu-pubblico');

  await page.getByRole('link', { name: 'Statistiche' }).first().click();
  await page.getByRole('button', { name: 'Esporta una serata' }).click();
  await expect(page.getByRole('dialog', { name: 'Esporta una serata' })).toBeVisible();
  await shot(page, 'festival-08-esporta');
  const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Scarica / }).first().click()]);
  expect(pdf.suggestedFilename()).toMatch(/^report_.*\.pdf$/);
  await pdf.saveAs(new URL('./.run/schermate/report-serata.pdf', import.meta.url).pathname);   // da guardare a occhio

  await page.getByRole('button', { name: 'Esporta una serata' }).click();
  await page.getByRole('tab', { name: 'CSV righe' }).click();
  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /^Scarica / }).first().click()]);
  expect(csv.suggestedFilename()).toMatch(/_righe\.csv$/);
});
