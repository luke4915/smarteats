import { test, expect } from '@playwright/test';
import { seed, login, shot } from './support.js';

// Dati riservati: l'admin accende il blocco; le statistiche si chiudono dietro la password di un amministratore,
// si aprono per qualche minuto e si richiudono a comando. Il blocco si spegne alla fine: i locali di prova sono condivisi.
test('dati riservati: blocco acceso, sblocco con la password, blocco anticipato', async ({ page }) => {
  const { restaurant: r, password } = seed();
  await login(page, r.host, r.admin);
  const setLock = async (on) => {
    await page.locator('a[href="/settings"]').first().click();
    await page.getByRole('tab', { name: 'Dati riservati' }).click();
    const toggle = page.getByRole('switch', { name: 'Blocca i dati riservati' });
    await expect(toggle).toBeEnabled();
    if ((await toggle.getAttribute('aria-checked') === 'true') !== on) {
      await toggle.click();
      if (!on) {                       // per togliere il blocco serve la password
        await page.getByLabel('La tua password').fill(password);
        await page.getByRole('button', { name: 'Togli il blocco' }).click();
      }
    }
    await expect(toggle).toHaveAttribute('aria-checked', String(on));
  };

  try {
    await setLock(true);
    await shot(page, 'reserved-01-impostazione');

    await page.locator('a[href="/stats"]').first().click();
    await expect(page.getByRole('heading', { name: 'Dati riservati' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Statistiche' })).toHaveCount(0);   // nemmeno la schermata: i dati non si chiedono
    await shot(page, 'reserved-02-bloccato');

    await page.getByLabel("Password dell'amministratore").fill('password-sbagliata');
    await page.getByRole('button', { name: 'Sblocca' }).click();
    await expect(page.getByRole('alert')).toContainText('non corretta');

    await page.getByLabel("Password dell'amministratore").fill(password);
    await page.getByRole('button', { name: 'Sblocca' }).click();
    await expect(page.getByRole('heading', { name: 'Statistiche' })).toBeVisible();
    await expect(page.getByText(/sbloccati fino alle \d{2}:\d{2}/)).toBeVisible();
    await shot(page, 'reserved-03-sbloccato');

    await page.getByRole('button', { name: 'Blocca ora' }).click();
    await expect(page.getByRole('heading', { name: 'Dati riservati' })).toBeVisible();
  } finally {
    await setLock(false);
  }
});
