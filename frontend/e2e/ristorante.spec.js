import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// Il giro principale del ristorante, con due schermi: il cameriere (sala) e la cucina.
test.describe.configure({ mode: 'serial' });

// Segna pronte tutte le comande visibili, una alla volta, aspettando che ognuna sparisca prima della successiva.
async function segnaTuttoPronto(page) {
  const pronta = page.getByRole('button', { name: 'Pronta', exact: true });
  await expect(pronta.first()).toBeVisible();
  for (let i = 0; i < 6 && await pronta.count(); i++) {
    const before = await pronta.count();
    // La cucina si aggiorna da sola: se la comanda sparisce un attimo prima del tocco, non è un errore
    const done = await pronta.first().click({ timeout: 3000 }).then(() => true, () => false);
    if (done) await expect(pronta).toHaveCount(before - 1, { timeout: 8000 });
  }
}

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
  await expect(sala.getByText('Esce subito')).toBeVisible();
  await expect(sala.locator('ol').getByText('Antipasti', { exact: true })).toBeVisible();
  await expect(sala.locator('ol').getByText('Primi', { exact: true })).toBeVisible();

  // Un piatto si apre per intero: la nota resta mentre si scrive (maiuscole come nella cassa), e si sposta di uscita
  await sala.getByRole('button', { name: 'Modifica Acqua' }).click();
  await sala.getByLabel('Nota per la cucina').pressSequentially('senza ghiaccio', { delay: 20 });
  await expect(sala.getByLabel('Nota per la cucina')).toHaveValue('SENZA GHIACCIO');
  await shot(sala, 'ristorante-03b-piatto');
  await sala.getByRole('button', { name: 'Fatto' }).click();
  await expect(sala.getByText('SENZA GHIACCIO')).toBeVisible();

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
  await segnaTuttoPronto(cucina);
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

  // Statistiche: il conto appena pagato compare, con l'occupazione dei posti e la curva del servizio
  await sala.locator('a[href="/statistiche"]').first().click();
  await expect(sala.getByText('Posti occupati', { exact: true })).toBeVisible();
  await expect(sala.getByText('Abbinamento gruppo-tavolo')).toBeVisible();
  await shot(sala, 'ristorante-10-statistiche');
});

test('ristorante: il cameriere non vede incassa e sconti', async ({ page }) => {
  const { ristorante: r } = seed();
  await login(page, r.host, r.cameriere);
  await page.getByRole('button', { name: /^T3: Libero/ }).click();   // T1 è del giro principale, T2 delle prenotazioni
  await page.getByRole('button', { name: 'Apri tavolo' }).click();
  await expect(page.getByRole('button', { name: 'Aggiungi' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Incassa' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Chiedi il conto' })).toBeVisible();
  await shot(page, 'ristorante-08-cameriere');
});

test('ristorante: alla romana in 3 quote, senza uscire dalla schermata di incasso', async ({ page }) => {
  const { ristorante: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('button', { name: /^T4: Libero/ }).click();
  await page.getByRole('button', { name: 'Apri tavolo' }).click();
  await page.getByRole('button', { name: 'Aggiungi' }).click();
  await page.getByRole('button', { name: /Vino della casa/ }).click();   // 18 € + coperto
  await page.getByRole('button', { name: 'Invia in cucina' }).click();
  await page.getByRole('button', { name: 'Incassa' }).click();
  await page.getByRole('tab', { name: 'A importo' }).click();
  await page.getByRole('button', { name: '3', exact: true }).click();

  for (const left of [2, 1]) {
    await page.getByRole('button', { name: /^Incassa [0-9]/ }).click();
    await expect(page.getByRole('heading', { name: 'Incassa' })).toBeVisible();        // ancora qui
    await expect(page.getByRole('button', { name: left === 1 ? 'Tutto' : String(left), exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
  await shot(page, 'ristorante-09-romana-ultima-quota');
  await page.getByRole('button', { name: /^Incassa [0-9]/ }).click();                 // l'ultima quota chiude il conto
  await expect(page.getByRole('button', { name: /^T4: Libero/ })).toBeVisible({ timeout: 10_000 });
});
