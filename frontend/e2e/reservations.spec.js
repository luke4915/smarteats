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

  // Dall'agenda, «Vai al tavolo» porta sul tavolo giusto (non solo alla Sala)
  // Dalla Timeline, la prenotazione è un blocco sul tavolo: un tocco apre il dettaglio, «Vai al tavolo» il conto
  await page.getByRole('link', { name: 'Prenotazioni' }).click();
  await page.getByRole('button', { name: /Rossi, 4 persone/ }).first().click();
  await shot(page, 'reservations-07-timeline');
  await page.getByRole('button', { name: 'Vai al tavolo' }).click();
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
