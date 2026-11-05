import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

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

// Menu pubblico: un suggerimento discreto (una riga, scartabile) propone un prodotto a chi ne sceglie un altro.
test('sagra: suggerimento nel menu pubblico', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await page.getByRole('link', { name: 'Impostazioni' }).first().click();
  await page.getByRole('tablist', { name: 'Sezioni delle impostazioni' }).getByRole('tab', { name: 'Menu pubblico' }).click();

  await page.getByLabel('Quando sceglie').selectOption({ label: 'Panini' });
  await page.getByLabel('Proponi').selectOption({ label: 'Birra' });
  await page.getByRole('button', { name: 'Aggiungi', exact: true }).click();
  await page.getByRole('button', { name: 'Salva suggerimenti' }).click();
  await expect(page.getByText('Suggerimenti salvati')).toBeVisible();
  await shot(page, 'festival-09-menu-suggerimenti');

  const client = await page.context().newPage();                                                  // un cliente, dal QR
  await client.goto(`${urlOf(festival.host)}/menu`);
  await expect(client.getByRole('note')).toHaveCount(0);                                            // a carrello vuoto nessun suggerimento
  await client.getByRole('tab', { name: 'Panini' }).click();
  await client.getByRole('button', { name: 'Aggiungi Panino con salsiccia' }).click();
  const nudge = client.getByRole('note');
  await expect(nudge).toContainText('Ci sta bene anche: Birra');
  await shot(client, 'festival-10-menu-suggerimento');
  await nudge.getByRole('button', { name: 'Nascondi il suggerimento' }).click();
  await expect(nudge).toHaveCount(0);                                                               // scartato: non torna
  await client.getByRole('button', { name: 'Una in più: Panino con salsiccia' }).click();
  await expect(nudge).toHaveCount(0);

  // si rimette a posto il locale di prova
  await page.evaluate(async () => {
    const call = (path, body) => fetch(`/api${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    await call('/menu-suggestions', { rules: [] });
  });
});

// Il menu dei clienti si usa dal telefono (iPhone e Android), in verticale e in orizzontale, senza accedere: niente scorrimento orizzontale,
// il pulsante dell'ordine sempre raggiungibile e il QR che si apre.
test('menu pubblico da telefono: senza accesso, scorre, il pulsante dell\'ordine si raggiunge e il QR si apre', async ({ page }) => {
  const { festival } = seed();
  for (const [width, height] of [[390, 664], [740, 360]]) {
    await page.setViewportSize({ width, height });
    await page.goto(`${urlOf(festival.host)}/menu/`);                                                // anche con la barra finale, senza passare dal login
    await expect(page).toHaveURL(/\/menu\/?$/);
    await page.getByRole('tab', { name: 'Panini' }).click();
    await page.getByRole('button', { name: 'Aggiungi Panino con salsiccia' }).click();
    // il cliente cambia l'aspetto con il sole/luna in alto: la scelta si applica subito
    const html = page.locator('html');
    const wasDark = ((await html.getAttribute('class')) ?? '').includes('dark');
    await page.getByRole('button', { name: wasDark ? "Passa all'aspetto chiaro" : "Passa all'aspetto scuro" }).click();
    await expect(html).toHaveClass(wasDark ? /^(?!.*dark)/ : /dark/);
    await page.getByRole('button', { name: wasDark ? "Passa all'aspetto scuro" : "Passa all'aspetto chiaro" }).click();
    const order = page.getByRole('button', { name: /Mostra il QR/ });
    await expect(order).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const scroller = page.locator('div.fixed.inset-0').first();
    await scroller.evaluate(el => el.scrollTo(0, el.scrollHeight));
    await expect(page.getByRole('link', { name: 'Privacy' })).toBeInViewport();                     // fino in fondo si arriva
    await shot(page, `festival-11-menu-telefono-${width}`);
    await order.click();
    await expect(page.getByRole('dialog', { name: 'Il tuo ordine' }).locator('canvas')).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

// Impostazioni → Informazioni: versione e stato della licenza.
test('informazioni: si vedono la versione e lo stato della licenza', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Impostazioni' }).click();
  await page.getByRole('tab', { name: 'Informazioni' }).click();
  await expect(page.getByText('Versione di SmartEats', { exact: true })).toBeVisible();
  await expect(page.getByText(/^Licenza /).first()).toBeVisible();
  await shot(page, 'settings-05-informazioni');
});
