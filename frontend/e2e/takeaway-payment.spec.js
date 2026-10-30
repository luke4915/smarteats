import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

// Asporto pagato con carta (Stripe finto): il locale lo rende facoltativo, il cliente sceglie «Paga ora» e viene mandato alla pagina di
// pagamento; se la chiude, dalla pagina del suo ordine può riprendere. Il giro completo con l'avviso di Stripe è nei test col database.
test('asporto con carta: il locale lo accende, il cliente sceglie «Paga ora» e può riprendere il pagamento', async ({ page, browser }) => {
  test.setTimeout(90_000);
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.locator('a[href="/settings"]').first().click();
  await page.getByRole('tab', { name: 'Asporto' }).click();
  const toggle = page.getByRole('switch', { name: 'Ordini online' });
  if (await toggle.getAttribute('aria-checked') !== 'true') await toggle.click();
  const mode = page.getByLabel('Pagamento con carta sul sito');
  await expect(mode).toBeVisible();
  await mode.selectOption('optional');
  await expect(page.getByText('Pagamento aggiornato').first()).toBeVisible();
  await shot(page, 'payment-01-impostazioni');

  try {
    const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, ignoreHTTPSErrors: true })).newPage();
    await phone.goto(`${urlOf(r.host)}/order`);
    // I pallini in cima si riempiono man mano che si completano i passi
    await expect(phone.getByRole('list', { name: 'Passo 1 di 4: Il tuo ordine' })).toBeVisible();
    await phone.getByRole('button', { name: /^Aggiungi / }).first().click();
    await expect(phone.getByRole('list', { name: 'Passo 2 di 4: Quando ritiri?' })).toBeVisible();
    await phone.getByRole('button', { name: /Continua/ }).click();
    await shot(phone, 'payment-01b-riepilogo');                                                          // in cima: pallini, «Modifica l'ordine» e il primo passo, senza sovrapposizioni
    await phone.locator('[role=radiogroup][aria-label=Giorno] [role=radio]:not([disabled])').first().click();
    await expect(phone.getByRole('list', { name: 'Passo 2 di 4: Quando ritiri?' })).toBeVisible();      // scelto il giorno, manca ancora l'ora
    await phone.locator('[role=radiogroup][aria-label="Orario di ritiro"] [role=radio]:not([disabled])').last().click();
    await expect(phone.getByRole('list', { name: 'Passo 3 di 4: I tuoi dati' })).toBeVisible();
    await phone.getByLabel('Nome', { exact: true }).fill('Carla Pagante');
    await phone.getByLabel('Telefono', { exact: true }).fill('333 5550199');
    await expect(phone.getByRole('list', { name: 'Passo 3 di 4: I tuoi dati' })).toBeVisible();        // senza il consenso i dati non sono completi
    await phone.getByRole('checkbox').check();
    await expect(phone.getByRole('list', { name: 'Tutti i passi completati (4 di 4)' })).toBeVisible();
    await expect(phone.getByRole('radio', { name: /Paga ora con carta/ })).toHaveAttribute('aria-checked', 'true');
    await expect(phone.getByRole('radio', { name: /Paga al ritiro/ })).toBeVisible();
    await phone.waitForTimeout(3200);
    await shot(phone, 'payment-02-scelta');

    await phone.getByRole('button', { name: /^Vai al pagamento/ }).click();
    // Il driver finto manda alla nostra pagina di pagamento di prova (al posto di quella di Stripe)
    await expect(phone).toHaveURL(/\/mock-checkout\/cs_mock_\d+\?return=/);
    // La pagina di prova porta nell'indirizzo il ritorno al sito (come il pulsante «torna al sito» di Stripe): da lì si ricava la pagina dell'ordine
    const back = new URL(phone.url()).searchParams.get('return');
    const token = new URL(back).pathname.split('/').pop();
    await expect(phone.getByRole('heading', { name: 'Pagamento di prova' })).toBeVisible();
    await shot(phone, 'payment-02b-pagina-di-prova');

    // Ha chiuso la pagina di pagamento: torna alla pagina del suo ordine e può finire di pagare
    await phone.goto(`${urlOf(r.host)}/order/${token}?pagamento=annullato`);
    await expect(phone.getByText('Manca il pagamento')).toBeVisible();
    await shot(phone, 'payment-03-da-completare');
    await phone.getByRole('button', { name: 'Completa il pagamento' }).click();
    await expect(phone.getByRole('heading', { name: 'Pagamento di prova' })).toBeVisible();

    // Il locale non vede ancora nulla: la richiesta esiste solo quando la carta è autorizzata
    await page.goto(`${urlOf(r.host)}/takeaway`);
    await expect(page.getByText('Carla Pagante')).toHaveCount(0);

    // «Pagamento riuscito» manda lo stesso avviso firmato di Stripe: il cliente torna al suo ordine e il locale ora lo vede
    await phone.getByRole('button', { name: 'Pagamento riuscito' }).click();
    await expect(phone).toHaveURL(new RegExp(`/order/${token}`));
    await expect(phone.getByRole('heading', { name: /Richiesta ricevuta|Ordine ricevuto|ricevut/i }).first()).toBeVisible({ timeout: 10_000 });
    // Il locale la vede nella campanella (l'elenco dell'Asporto mostra un giorno solo: dopo cena il primo ritiro libero è domani)
    await page.goto(`${urlOf(r.host)}/floor`);
    const bell = page.getByRole('button', { name: /^Notifiche/ });
    await expect(bell).toContainText('1', { timeout: 15_000 });
    await bell.click();
    await expect(page.getByRole('menuitem', { name: /Ordine da asporto · Carla Pagante/ })).toBeVisible();
    await page.keyboard.press('Escape');

    // Si ripulisce: il cliente ritira la richiesta (la carta autorizzata si rilascia), così non resta una richiesta in attesa per i test dopo
    await phone.getByRole('button', { name: 'Ritira la richiesta' }).click();
    await phone.getByRole('button', { name: 'Sì, ritira' }).click();
    await expect(phone.getByText(/annullat|ritirat/i).first()).toBeVisible({ timeout: 10_000 });
  } finally {
    await page.locator('a[href="/settings"]').first().click();
    await page.getByRole('tab', { name: 'Asporto' }).click();
    await page.getByLabel('Pagamento con carta sul sito').selectOption('off');
    await expect(page.getByText('Pagamento aggiornato').first()).toBeVisible();
  }
});
