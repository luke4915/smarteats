import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// Il giro principale del ristorante, con due schermi: il cameriere (sala) e la cucina.
test.describe.configure({ mode: 'serial' });

test('ristorante: apro un tavolo, ordino per portate, la cucina segna pronto, incasso', async ({ browser }) => {
  const { ristorante: r } = seed();
  const sala = await (await browser.newContext()).newPage();
  const cucina = await (await browser.newContext()).newPage();

  // ── Sala ──
  await login(sala, r.host, r.admin);
  await expect(sala.getByRole('button', { name: /^T1: Libero/ })).toBeVisible();
  await shot(sala, 'ristorante-01-sala');

  await sala.getByRole('button', { name: /^T1: Libero/ }).click();
  await sala.getByRole('button', { name: 'Apri tavolo' }).click();
  await expect(sala.getByRole('heading', { name: 'T1' })).toBeVisible();
  await shot(sala, 'ristorante-02-conto-vuoto');

  await sala.getByRole('button', { name: 'Aggiungi' }).click();
  await sala.getByRole('button', { name: /Bruschetta/ }).click();
  await sala.getByRole('button', { name: /Spaghetti alle vongole/ }).click();
  await sala.getByRole('button', { name: /Acqua/ }).click();
  await shot(sala, 'ristorante-03-comanda');
  await expect(sala.getByRole('heading', { name: 'Antipasti' })).toBeVisible();
  await expect(sala.getByRole('heading', { name: 'Primi' })).toBeVisible();

  await sala.getByRole('button', { name: 'Invia in cucina' }).click();
  await expect(sala.getByRole('button', { name: 'Incassa' })).toBeVisible();   // si è tornati al conto
  await expect(sala.getByText(/Da mandare/).first()).toBeVisible();            // i primi restano sul conto
  await shot(sala, 'ristorante-04-conto-con-portate');

  // ── Cucina: vede le bevande e gli antipasti (escono insieme), non ancora i primi ──
  await login(cucina, r.host, r.cucina);
  await expect(cucina.getByRole('heading', { name: 'Cucina' })).toBeVisible();
  await expect(cucina.getByText('Bruschetta')).toBeVisible();
  await expect(cucina.getByText('Acqua')).toBeVisible();
  await expect(cucina.getByText('Spaghetti alle vongole')).toHaveCount(0);
  await shot(cucina, 'ristorante-05-cucina');
  while (await cucina.getByRole('button', { name: 'Pronta', exact: true }).count()) await cucina.getByRole('button', { name: 'Pronta', exact: true }).first().click();
  await expect(cucina.getByText('Bruschetta')).toHaveCount(0);

  // ── Sala: avviso di pronto, poi mando i primi e incasso tutto ──
  await expect(sala.getByText(/Tavolo T1: Antipasti pronti/)).toBeVisible({ timeout: 10_000 });
  await sala.getByRole('button', { name: /Manda/ }).click();
  await expect(cucina.getByText('Spaghetti alle vongole')).toBeVisible({ timeout: 10_000 });
  await cucina.getByRole('button', { name: 'Pronta', exact: true }).click();

  await sala.getByRole('button', { name: 'Incassa' }).click();
  await shot(sala, 'ristorante-06-incasso');
  await sala.getByRole('button', { name: /^Incassa [0-9]/ }).click();

  // Incasso senza resto: il pannello torna da solo alla sala e il tavolo è libero
  await expect(sala.getByRole('button', { name: /^T1: Libero/ })).toBeVisible({ timeout: 10_000 });
  await shot(sala, 'ristorante-07-tavolo-libero');
});

test('ristorante: il cameriere non vede incassa e sconti', async ({ page }) => {
  const { ristorante: r } = seed();
  await login(page, r.host, r.cameriere);
  await page.getByRole('button', { name: /^T2: Libero/ }).click();
  await page.getByRole('button', { name: 'Apri tavolo' }).click();
  await expect(page.getByRole('button', { name: 'Aggiungi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Incassa' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chiedi il conto' })).toBeVisible();
  await shot(page, 'ristorante-08-cameriere');
});
