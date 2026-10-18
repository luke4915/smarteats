import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

// L'asporto: il titolare lo accende, un cliente ordina dal telefono, il locale approva dalla campanella, la cucina
// vede l'ordine con orario e nome, si consegna e si incassa. Poi un ordine preso al banco.
test('asporto: ordine dal sito → approvazione → cucina → ritiro; ordine al banco', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.locator('a[href="/settings"]').first().click();
  await page.getByRole('button', { name: 'Asporto' }).first().click();
  const toggle = page.getByRole('switch', { name: 'Ordini online' });
  await expect(toggle).toBeVisible();
  if (await toggle.getAttribute('aria-checked') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'takeaway-01-impostazioni');

  // Il cliente, dal telefono
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ignoreHTTPSErrors: true })).newPage();
  await phone.goto(`${urlOf(r.host)}/order`);
  await expect(phone.getByRole('heading', { level: 1 })).toBeVisible();
  await shot(phone, 'takeaway-02a-pagina');
  const add = phone.getByRole('button', { name: /^Aggiungi / }).first();
  await add.click();
  await phone.getByRole('button', { name: /^Una in più/ }).first().click();           // due pezzi
  await shot(phone, 'takeaway-02-menu');
  await phone.getByRole('button', { name: /Continua/ }).click();
  await phone.locator('[role=radiogroup][aria-label=Giorno] [role=radio]:not([disabled])').first().click();
  await phone.locator('[role=radiogroup][aria-label="Orario di ritiro"] [role=radio]:not([disabled])').last().click();
  await phone.getByLabel('Nome', { exact: true }).fill('Giulia Verdi');
  await phone.getByLabel('Telefono', { exact: true }).fill('333 5550123');
  await phone.getByRole('checkbox').check();
  await phone.waitForTimeout(3200);
  await shot(phone, 'takeaway-03-riepilogo');
  await phone.getByRole('button', { name: /^Invia l'ordine/ }).click();
  await expect(phone.getByRole('heading', { name: 'Ordine ricevuto' })).toBeVisible();
  expect(phone.url()).toMatch(/\/order\/[A-Za-z0-9_-]{20,}$/);

  // Il titolare vede la campanella e approva da lì
  await page.goto(`${urlOf(r.host)}/floor`);
  const bell = page.getByRole('button', { name: /^Notifiche/ });
  await expect(bell).toContainText('1', { timeout: 15_000 });
  await bell.click();
  await page.getByRole('menuitem', { name: /Ordine da asporto · Giulia Verdi/ }).click();
  await expect(page.getByRole('heading', { name: 'Giulia Verdi' })).toBeVisible();
  await shot(page, 'takeaway-04-da-approvare');
  await page.getByRole('button', { name: 'Accetta', exact: true }).last().click();
  await expect(page.getByText('Ordine accettato').first()).toBeVisible();

  // Il cliente vede la conferma senza ricaricare
  await expect(phone.getByRole('heading', { name: 'Ordine confermato' })).toBeVisible({ timeout: 30_000 });

  // La cucina lo vede con il nome di chi ritira
  const cucina = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  await login(cucina, r.host, r.kitchen);
  await expect(cucina.getByText(/Giulia Verdi/)).toBeVisible();
  await shot(cucina, 'takeaway-05-cucina');
  await cucina.locator('article', { hasText: 'Giulia Verdi' }).getByRole('button', { name: 'Pronta', exact: true }).click();

  // Consegna e incasso
  await expect(page.getByText('Pronto', { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: /^Consegna e incassa/ }).click();
  await page.getByRole('button', { name: 'Contanti' }).click();
  await expect(page.getByText('Consegnato e incassato').first()).toBeVisible();
  await expect(phone.getByRole('heading', { name: 'Ordine ritirato' })).toBeVisible({ timeout: 30_000 });

  // Un ordine al banco: carta a sinistra, riepilogo a destra
  await page.getByRole('button', { name: 'Nuovo ordine' }).click();
  await page.getByRole('button', { name: /Acqua/ }).first().click();
  await page.getByLabel('Nome', { exact: true }).fill('Al banco');
  await shot(page, 'takeaway-06-nuovo-ordine');
  await page.getByRole('button', { name: /^Inserisci l'ordine/ }).click();
  await expect(page.getByText('Ordine inserito').first()).toBeVisible();
});
