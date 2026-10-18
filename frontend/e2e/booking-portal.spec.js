import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

// Il portale pubblico: il titolare lo accende, un cliente (senza accesso) invia una richiesta dal telefono, vede il suo
// link con lo stato e la annulla.
test('portale: lo accendo, il cliente invia una richiesta dal telefono e la annulla dal suo link', async ({ page, browser }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.locator('a[href="/settings"]').first().click();
  await page.getByRole('button', { name: 'Prenotazioni' }).first().click();
  await expect(page.getByRole('switch', { name: 'Prenotazioni online' })).toBeVisible();
  await page.getByLabel('Telefono da mostrare ai clienti', { exact: false }).fill('0123 456789');
  await page.getByLabel('Messaggio in cima alla pagina', { exact: false }).fill('Il giovedì siamo chiusi.');
  await page.getByLabel('Messaggio in cima alla pagina', { exact: false }).blur();
  const toggle = page.getByRole('switch', { name: 'Prenotazioni online' });
  if (await toggle.getAttribute('aria-checked') !== 'true') await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await shot(page, 'booking-portal-01-impostazioni');

  // Anche chi è già dentro (il titolare che prova la pagina) la vede, non viene rimandato alla Sala
  await page.goto(`${urlOf(r.host)}/book`);
  await expect(page.getByText('Quanti siete?')).toBeVisible();

  // Il cliente: telefono, nessun accesso
  const phone = await (await browser.newContext({ viewport: { width: 390, height: 844 }, ignoreHTTPSErrors: true })).newPage();
  await phone.goto(`${urlOf(r.host)}/book`);
  await expect(phone.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(phone.getByText('Il giovedì siamo chiusi.')).toBeVisible();
  await phone.getByRole('button', { name: 'Una persona in più' }).click();           // 3 persone
  await expect(phone.getByText('3', { exact: true }).first()).toBeVisible();
  await phone.getByRole('radio', { name: /./ }).and(phone.locator('[aria-checked]')).first().waitFor();
  await phone.locator('[role=radiogroup][aria-label=Giorno] [role=radio]:not([disabled])').nth(2).click();   // fra tre giorni: non oggi
  await phone.locator('[role=radiogroup][aria-label=Turno] [role=radio]:not([disabled])').first().click();
  await phone.getByLabel('Nome', { exact: true }).fill('Famiglia Bianchi');
  await phone.getByLabel('Telefono', { exact: true }).fill('333 9876543');
  await phone.getByLabel('Note', { exact: false }).fill('Un seggiolone');
  await expect(phone.getByRole('button', { name: 'Invia richiesta' })).toBeDisabled();   // manca il consenso
  await phone.getByRole('checkbox').first().check();     // il consenso al trattamento; la casella di fidelizzazione è facoltativa
  await phone.waitForTimeout(3200);                                                       // il modulo non si invia in un lampo
  await shot(phone, 'booking-portal-02-modulo');
  await phone.getByRole('button', { name: 'Invia richiesta' }).click();

  await expect(phone.getByRole('heading', { name: 'Richiesta ricevuta' })).toBeVisible();
  expect(phone.url()).toMatch(/\/book\/[A-Za-z0-9_-]{20,}$/);
  await expect(phone.getByText('Famiglia Bianchi')).toBeVisible();
  await shot(phone, 'booking-portal-03-ricevuta');

  // Il titolare (che aveva aperto la pagina pubblica) torna all'app
  await page.goto(`${urlOf(r.host)}/floor`);
  // Il titolare vede la notifica: campanella con il numero, e dalla voce arriva alla richiesta da approvare
  const bell = page.getByRole('button', { name: /^Notifiche/ });
  await expect(bell).toContainText('1', { timeout: 15_000 });
  await bell.click();
  await shot(page, 'booking-portal-05-campanella');
  await page.getByRole('menuitem', { name: /Nuova richiesta · Famiglia Bianchi/ }).click();
  await expect(page.getByRole('button', { name: 'Conferma', exact: true })).toBeVisible();
  // il locale vede lo stato degli avvisi WhatsApp (sola lettura): «Ricevuta» è in coda, parte dopo 2 minuti
  await expect(page.getByRole('region', { name: 'Avvisi WhatsApp' })).toContainText('Ricevuta');
  await page.getByRole('button', { name: 'Conferma', exact: true }).click();
  await expect(page.getByText('Prenotazione confermata').first()).toBeVisible();

  // Confermata: il cliente non annulla da solo, chiede l'annullo
  await phone.reload();
  await expect(phone.getByRole('heading', { name: 'Prenotazione confermata' })).toBeVisible();
  await expect(phone.getByRole('button', { name: 'Ritira la richiesta' })).toHaveCount(0);
  await phone.getByRole('button', { name: 'Chiedi di annullare' }).click();
  await phone.getByRole('button', { name: 'Invia la richiesta' }).click();
  await expect(phone.getByText(/Hai chiesto di annullare/)).toBeVisible();

  // Il locale lo vede nella campanella e decide
  await expect(bell).toContainText('1', { timeout: 15_000 });
  await bell.click();
  await page.getByRole('menuitem', { name: /Chiede di annullare · Famiglia Bianchi/ }).click();
  await expect(page.getByText('Il cliente chiede di annullare')).toBeVisible();
  await shot(page, 'booking-portal-06-annullo');
  await page.getByRole('button', { name: "Conferma l'annullo" }).click();
  await phone.reload();
  await expect(phone.getByRole('heading', { name: 'Richiesta annullata' })).toBeVisible();
});

// Il body dell'app è bloccato: la pagina dei clienti deve scorrere da sola, in verticale e in orizzontale.
for (const [name, viewport] of [['verticale', { width: 390, height: 664 }], ['orizzontale', { width: 740, height: 360 }]]) {
  test(`portale: da telefono in ${name} la pagina scorre e l'invio resta raggiungibile`, async ({ page, browser }) => {
    const { restaurant: r } = seed();
    await login(page, r.host, r.admin);
    await page.locator('a[href="/settings"]').first().click();
    await page.getByRole('button', { name: 'Prenotazioni' }).first().click();
    const toggle = page.getByRole('switch', { name: 'Prenotazioni online' });
    await expect(toggle).toBeVisible();
    if (await toggle.getAttribute('aria-checked') !== 'true') await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');

    const phone = await (await browser.newContext({ viewport, hasTouch: true, isMobile: true, ignoreHTTPSErrors: true })).newPage();
    await phone.goto(`${urlOf(r.host)}/book`);
    await phone.locator('[role=radiogroup][aria-label=Giorno] [role=radio]:not([disabled])').first().click();
    await phone.locator('[role=radiogroup][aria-label=Turno] [role=radio]:not([disabled])').first().click();
    await phone.getByLabel('Nome', { exact: true }).fill('Prova scorrimento');

    const scroller = phone.locator('div.fixed.inset-0');
    const m = await scroller.evaluate(el => ({ can: el.scrollHeight > el.clientHeight, body: getComputedStyle(document.body).overflow }));
    expect(m.body).toBe('hidden');                                     // è il contenitore a scorrere, non il body
    expect(m.can).toBe(true);
    const before = await scroller.evaluate(el => el.scrollTop);
    await scroller.evaluate(el => el.scrollTo(0, el.scrollHeight));
    expect(await scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(before);
    await expect(phone.getByRole('button', { name: 'Invia richiesta' })).toBeInViewport();
    await shot(phone, `portale-04-${name}`);
  });
}
