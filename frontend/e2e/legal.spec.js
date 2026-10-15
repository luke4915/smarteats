import { test, expect } from '@playwright/test';
import { seed, shot, urlOf } from './support.js';

// Pagine pubbliche richieste da Meta e dai clienti: informativa privacy, condizioni, link breve dei messaggi.
test('privacy e condizioni: pubbliche, anche da telefono; il link breve non valido lo dice', async ({ page }) => {
  const { restaurant: r } = seed();
  await page.setViewportSize({ width: 390, height: 664 });
  await page.goto(`${urlOf(r.host)}/privacy`);
  await expect(page.getByRole('heading', { name: 'Informativa sulla privacy' })).toBeVisible();
  await expect(page.getByText(/titolare del trattamento è il locale/)).toBeVisible();
  await expect(page.getByText('90 giorni')).toBeVisible();
  const scroller = page.locator('div.fixed.inset-0');
  await scroller.evaluate(el => el.scrollTo(0, el.scrollHeight));
  await shot(page, 'legal-01-privacy');
  await page.getByRole('link', { name: "Condizioni d'uso" }).click();
  await expect(page.getByRole('heading', { name: "Condizioni d'uso" })).toBeVisible();
  await expect(page.getByText(/non è ancora una prenotazione|diventa una prenotazione o un ordine solo quando il locale la conferma/)).toBeVisible();

  await page.goto(`${urlOf(r.host)}/s/non-valido`);
  await expect(page.getByText('Link non valido.')).toBeVisible();
});
