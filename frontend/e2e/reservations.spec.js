import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// Il giro delle prenotazioni (P1): il personale inserisce una prenotazione, assegna il tavolo sulla pianta, la Sala la
// mostra sul tavolo e «Arrivato» apre il conto con i coperti già inseriti.
test('prenotazioni: inserisco, assegno il tavolo, la Sala lo segna, arrivato apre il conto', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);

  await page.getByRole('link', { name: 'Prenotazioni' }).click();
  await expect(page.getByRole('region', { name: /Timeline dei tavoli/ })).toBeVisible();
  await shot(page, 'reservations-00-timeline-vuota');
  await page.getByRole('tab', { name: 'Elenco' }).click();
  await expect(page.getByRole('heading', { name: /Cena 19:30/ })).toBeVisible();
  await shot(page, 'reservations-01-agenda-vuota');

  await page.getByRole('button', { name: 'Prenotazione', exact: true }).click();
  await page.getByRole('button', { name: /Cena 19:30/ }).click();
  await page.getByRole('button', { name: 'Più coperti' }).click();
  await page.getByRole('button', { name: 'Più coperti' }).click();
  await page.getByLabel('Nome').fill('Rossi');
  await page.getByLabel('Telefono').fill('333 1234567');
  await page.getByLabel('Note').fill('Seggiolone');
  await shot(page, 'reservations-02-nuova');
  await page.getByRole('button', { name: 'Salva', exact: true }).click();

  await expect(page.getByText('Confermata').first()).toBeVisible();
  await expect(page.getByText(/Avvisa il cliente/)).toBeVisible();
  await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute('href', /wa\.me\/393331234567/);
  await shot(page, 'reservations-03-dettaglio');

  // Tavoli sulla pianta
  await page.getByRole('button', { name: 'Assegna un tavolo' }).click();
  // Si parte dal tavolo consigliato per 4 persone (uno da 4 posti: nessun posto sprecato)
  const picked = page.locator('button[aria-pressed="true"]');
  await expect(picked).toHaveCount(1);
  await expect(picked).toHaveAccessibleName(/, 4 posti/);
  await expect(page.getByText('Preselezionato il più adatto')).toBeVisible();
  await shot(page, 'reservations-04-tavoli');
  // Un tavolo piccolo non regge il gruppo: l'assegnazione resta bloccata e dice quanti posti mancano
  await picked.click();
  await page.getByRole('button', { name: /^T3, 2 posti/ }).click();
  await expect(page.getByText(/2 posti per 4 persone: ne servono ancora 2/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Assegna', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: /^T3, 2 posti/ }).click();
  await page.getByRole('button', { name: /^T2, 4 posti/ }).click();
  await page.getByRole('button', { name: 'Assegna', exact: true }).click();
  await expect(page.getByRole('button', { name: /Arrivato/ })).toBeVisible();

  // La Sala lo mostra sul tavolo
  await page.getByRole('link', { name: 'Sala' }).click();
  await expect(page.getByRole('button', { name: /^T2: Libero/ })).toContainText('19:30');
  await shot(page, 'reservations-05-sala');

  // Arrivato dalla Sala: apre il conto con 4 coperti
  await page.getByRole('button', { name: /^T2: Libero/ }).click();
  await expect(page.getByText(/Prenotato/)).toBeVisible();
  await page.getByRole('button', { name: /Arrivato · Rossi/ }).click();
  await expect(page.getByRole('button', { name: /^T2: Occupato/ })).toContainText('4');
  await shot(page, 'reservations-06-conto-aperto');

  // Dall'agenda, «Apri il conto in Sala» porta sul tavolo giusto (non solo alla Sala)
  // Dalla Timeline, la prenotazione è un blocco sul tavolo: un tocco apre il dettaglio, «Apri il conto in Sala» il conto
  await page.getByRole('link', { name: 'Prenotazioni' }).click();
  await page.getByRole('button', { name: /Rossi, 4 persone/ }).first().click();
  await shot(page, 'reservations-07-timeline');
  await page.getByRole('button', { name: 'Apri il conto in Sala' }).click();
  await expect(page.getByRole('heading', { name: 'T2', exact: true })).toBeVisible();
});

test('walk-in: chi arriva senza prenotazione si siede al tavolo giusto e il conto si apre', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Prenotazioni' }).click();
  await page.getByRole('button', { name: /Walk-in/ }).click();
  await expect(page.getByText('Liberi e adatti')).toBeVisible();
  await shot(page, 'reservations-08-walk-in');
  await page.getByRole('button', { name: 'Più coperti' }).click();      // 3 persone: il tavolo da 2 non basta più
  await expect(page.getByRole('button', { name: /^T3 · Sala/ })).toHaveCount(0);
  // Si può scegliere un tavolo diverso da quello proposto: il pulsante in fondo lo segue
  const options = page.getByRole('button', { name: / · Sala/ });
  await expect(options.nth(1)).toBeVisible();
  const other = (await options.nth(1).innerText()).split(' ')[0];
  await options.nth(1).click();
  await expect(page.getByRole('button', { name: new RegExp(`^Fai sedere 3 persone al ${other}$`) })).toBeVisible();
  await page.getByRole('button', { name: /^Fai sedere 3 persone/ }).click();
  await expect(page.getByText(/Aperto · 3 cop\./)).toBeVisible();   // si è nel conto appena aperto, con 3 coperti
  // Il conto di prova si elimina, così il tavolo torna libero per gli altri test
  await page.getByRole('button', { name: 'Altre azioni' }).click();
  await page.getByRole('menuitem', { name: 'Elimina conto' }).click();
  await page.getByRole('button', { name: 'Sì, elimina' }).click();
  await expect(page.getByText(/Aperto · 3 cop\./)).toHaveCount(0);
});

test('walk-in dalla Sala: la mappa resta visibile, evidenzia i tavoli adatti e un tocco sceglie il tavolo', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('button', { name: 'Walk-in' }).click();
  await expect(page.getByText('Liberi e adatti')).toBeVisible();
  // la pianta c'è ancora: i tavoli si toccano per scegliere dove far sedere il gruppo
  await expect(page.getByRole('button', { name: /^T4: Libero/ })).toBeVisible();
  await page.getByRole('button', { name: 'Più coperti' }).click();         // 3 persone
  await page.getByRole('button', { name: /^T4: Libero/ }).click();
  await expect(page.getByRole('button', { name: /^Fai sedere 3 persone al T4$/ })).toBeVisible();
  await shot(page, 'reservations-10-walk-in-sala');
  await page.getByRole('button', { name: /^Fai sedere 3 persone/ }).click();
  await expect(page.getByText(/Aperto · 3 cop\./)).toBeVisible();
  // il conto di prova si elimina, così il tavolo torna libero per gli altri test
  await page.getByRole('button', { name: 'Altre azioni' }).click();
  await page.getByRole('menuitem', { name: 'Elimina conto' }).click();
  await page.getByRole('button', { name: 'Sì, elimina' }).click();
  await expect(page.getByText(/Aperto · 3 cop\./)).toHaveCount(0);
});

test('Timeline: un blocco «Senza prenotazione» apre un riepilogo nel pannello e solo il pulsante porta in Sala', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  // un walk-in dalla Sala apre un conto senza prenotazione
  await page.getByRole('button', { name: 'Walk-in' }).click();
  await page.getByRole('button', { name: /^Fai sedere 2 persone/ }).click();
  await expect(page.getByText(/Aperto · 2 cop\./)).toBeVisible();
  // in Prenotazioni il conto è un blocco sulla Timeline: un tocco NON cambia pagina, mostra il riepilogo
  await page.getByRole('link', { name: 'Prenotazioni' }).click();
  await page.getByRole('button', { name: /Senza prenotazione/ }).first().click();
  await expect(page).toHaveURL(/\/reservations/);
  await expect(page.getByText('Conto finora')).toBeVisible();
  await shot(page, 'reservations-11-senza-prenotazione');
  await page.getByRole('button', { name: 'Apri il conto in Sala' }).click();
  await expect(page).toHaveURL(/\/floor/);
  await expect(page.getByText(/Aperto · 2 cop\./)).toBeVisible();
  // il conto di prova si elimina
  await page.getByRole('button', { name: 'Altre azioni' }).click();
  await page.getByRole('menuitem', { name: 'Elimina conto' }).click();
  await page.getByRole('button', { name: 'Sì, elimina' }).click();
  await expect(page.getByText(/Aperto · 2 cop\./)).toHaveCount(0);
});

test('mese: il calendario riassume i giorni e un tocco porta alla Timeline di quel giorno', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Prenotazioni' }).click();
  await page.getByRole('tab', { name: 'Mensile' }).click();
  await expect(page.getByRole('region', { name: 'Calendario del mese' })).toBeVisible();
  await shot(page, 'reservations-09-mese');
  await page.getByRole('button', { name: 'Mese successivo' }).click();
  await expect(page.getByRole('button', { name: 'Mese corrente' })).toBeVisible();
  await page.getByRole('button', { name: 'Mese corrente' }).click();
  // Un giorno con prenotazioni mostra le persone: si apre la Timeline di quel giorno
  await page.getByRole('button', { name: /pieno$/ }).first().click();
  await expect(page.getByRole('region', { name: /Timeline dei tavoli/ })).toBeVisible();
});

// Aprendo il pannello il riquadro si stringe: i pulsanti della testata scivolano di lato ma non saltano mai su un'altra riga.
test('prenotazioni: aprendo il pannello i pulsanti della testata restano sulla stessa riga', async ({ page }) => {
  const { restaurant: r } = seed();
  await page.setViewportSize({ width: 1180, height: 800 });
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Prenotazioni' }).click();
  await page.getByRole('tab', { name: 'Elenco' }).click();
  const add = page.getByRole('button', { name: 'Prenotazione', exact: true });
  await expect(add).toBeVisible();
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => x.getAttribute('aria-label') === 'Prenotazione' || x.textContent.trim() === 'Prenotazione');
    window.__ys = new Set();
    const t0 = performance.now();
    const tick = () => { window.__ys.add(Math.round(b.getBoundingClientRect().y)); if (performance.now() - t0 < 800) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await add.click();
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => [...window.__ys])).toHaveLength(1);
});

// Sul telefono e sul tablet stretto la testata non si sovrappone: data, vista e azioni stanno ognuna al suo posto.
for (const width of [390, 820]) {
  test(`prenotazioni: la testata non si sovrappone a ${width} px`, async ({ page }) => {
    const { restaurant: r } = seed();
    await page.setViewportSize({ width, height: 844 });
    await login(page, r.host, r.admin);
    await page.getByRole('link', { name: 'Prenotazioni' }).click().catch(async () => { await page.getByRole('button', { name: 'Prenotazioni' }).click(); });
    const tabs = page.getByRole('tablist', { name: 'Vista' });
    await expect(tabs).toBeVisible();
    const boxes = await Promise.all([
      page.getByRole('button', { name: 'Giorno precedente' }), page.getByRole('button', { name: 'Giorno successivo' }), tabs, page.getByRole('button', { name: 'Prenotazione', exact: true }),
    ].map(l => l.boundingBox()));
    const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(overlap(boxes[i], boxes[j]), `${i} e ${j} si sovrappongono`).toBe(false);
    await shot(page, `reservations-12-testata-${width}`);
  });
}
