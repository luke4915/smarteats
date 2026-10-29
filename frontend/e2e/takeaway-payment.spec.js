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
    await phone.route('https://checkout.mock/**', route => route.fulfill({ contentType: 'text/html', body: '<h1>Pagina di pagamento (finta)</h1>' }));
    await phone.goto(`${urlOf(r.host)}/order`);
    await phone.getByRole('button', { name: /^Aggiungi / }).first().click();
    await phone.getByRole('button', { name: /Continua/ }).click();
    await phone.locator('[role=radiogroup][aria-label=Giorno] [role=radio]:not([disabled])').first().click();
    await phone.locator('[role=radiogroup][aria-label="Orario di ritiro"] [role=radio]:not([disabled])').last().click();
    await phone.getByLabel('Nome', { exact: true }).fill('Carla Pagante');
    await phone.getByLabel('Telefono', { exact: true }).fill('333 5550199');
    await phone.getByRole('checkbox').check();
    await expect(phone.getByRole('radio', { name: /Paga ora con carta/ })).toHaveAttribute('aria-checked', 'true');
    await expect(phone.getByRole('radio', { name: /Paga al ritiro/ })).toBeVisible();
    await phone.waitForTimeout(3200);
    await shot(phone, 'payment-02-scelta');

    await phone.getByRole('button', { name: /^Vai al pagamento/ }).click();
    await expect(phone).toHaveURL(/^https:\/\/checkout\.mock\/pay\/cs_mock_\d+\?return=/);
    // La pagina finta porta nell'indirizzo il ritorno al sito (come il pulsante «torna al sito» di Stripe): da lì si ricava la pagina dell'ordine
    const back = new URL(phone.url()).searchParams.get('return');
    const token = new URL(back).pathname.split('/').pop();
    await expect(phone.getByRole('heading', { name: /Pagina di pagamento/ })).toBeVisible();

    // Ha chiuso la pagina di pagamento: torna alla pagina del suo ordine e può finire di pagare
    await phone.goto(`${urlOf(r.host)}/order/${token}?pagamento=annullato`);
    await expect(phone.getByText('Manca il pagamento')).toBeVisible();
    await shot(phone, 'payment-03-da-completare');
    await phone.getByRole('button', { name: 'Completa il pagamento' }).click();
    await expect(phone.getByRole('heading', { name: /Pagina di pagamento/ })).toBeVisible();

    // Il locale non vede ancora nulla: la richiesta esiste solo quando la carta è autorizzata
    await page.goto(`${urlOf(r.host)}/takeaway`);
    await expect(page.getByText('Carla Pagante')).toHaveCount(0);
  } finally {
    await page.locator('a[href="/settings"]').first().click();
    await page.getByRole('tab', { name: 'Asporto' }).click();
    await page.getByLabel('Pagamento con carta sul sito').selectOption('off');
    await expect(page.getByText('Pagamento aggiornato').first()).toBeVisible();
  }
});
