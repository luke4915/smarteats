import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// Il giro delle prenotazioni (P1): il personale inserisce una prenotazione, assegna il tavolo sulla pianta, la Sala la
// mostra sul tavolo e «Arrivato» apre il conto con i coperti già inseriti.
test('prenotazioni: inserisco, assegno il tavolo, la Sala lo segna, arrivato apre il conto', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);

  await page.getByRole('link', { name: 'Prenotazioni' }).click();
  await expect(page.getByRole('heading', { name: 'Cena 19:30' })).toBeVisible();
  await shot(page, 'reservations-01-agenda-vuota');

  await page.getByRole('button', { name: 'Nuova' }).click();
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
  await page.getByRole('button', { name: 'T2', exact: true }).click();
  await shot(page, 'reservations-04-tavoli');
  await page.getByRole('button', { name: 'Assegna', exact: true }).click();
  await expect(page.getByRole('button', { name: /Arrivato/ })).toBeVisible();

  // La Sala lo mostra sul tavolo
  await page.getByRole('link', { name: 'Sala' }).click();
  await expect(page.getByRole('button', { name: /^T2: Libero/ })).toContainText('Rossi');
  await shot(page, 'reservations-05-sala');

  // Arrivato dalla Sala: apre il conto con 4 coperti
  await page.getByRole('button', { name: /^T2: Libero/ }).click();
  await expect(page.getByText(/Prenotato/)).toBeVisible();
  await page.getByRole('button', { name: /Arrivato · Rossi/ }).click();
  await expect(page.getByRole('button', { name: /^T2: Occupato/ })).toContainText('4/');
  await shot(page, 'reservations-06-conto-aperto');

  // Dall'agenda, «Vai al tavolo» porta sul tavolo giusto (non solo alla Sala)
  await page.getByRole('link', { name: 'Prenotazioni' }).click();
  await page.getByRole('button', { name: /Rossi/ }).first().click();
  await page.getByRole('button', { name: 'Vai al tavolo' }).click();
  await expect(page.getByRole('heading', { name: 'T2', exact: true })).toBeVisible();
});
