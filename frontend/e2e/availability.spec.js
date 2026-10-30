import { test, expect } from '@playwright/test';
import { seed, login, urlOf, shot } from './support.js';

// Tenere premuta una tessera per un secondo apre la disponibilità del prodotto (Disponibile, Quantità, Esaurito) e il cambio arriva
// subito a tutte le casse. Lo fa anche chi ha il ruolo «cassa» (non solo l'amministratore), e un prodotto esaurito si rimette in vendita.
const press = async (page, tile, ms) => {
  const box = await tile.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
};

test('sagra: la cassa segna un prodotto esaurito tenendo premuto, le altre casse lo vedono subito, e lo rimette in vendita', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.cashier);
  const tile = page.getByRole('button', { name: /^Birra/ });
  await expect(tile).toBeVisible();
  await expect(page.getByText('Tieni premuto un prodotto per cambiarne la disponibilità.')).toBeVisible();   // il gesto non resta nascosto

  // un'altra cassa, già aperta: deve vedere il cambio senza ricaricare
  const other = await page.context().newPage();
  await other.goto(`${urlOf(festival.host)}/`);
  const otherTile = other.getByRole('button', { name: /^Birra/ });
  await expect(otherTile).toBeVisible();

  // un tocco lento (mezzo secondo) è ancora un tocco: aggiunge il prodotto e non apre nulla
  await press(page, tile, 400);
  await expect(page.getByRole('button', { name: 'Una in meno: Birra' })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Una in meno: Birra' }).click();

  // sotto il secondo non scatta; a un secondo si apre la disponibilità
  await press(page, tile, 700);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Una in meno: Birra' })).toHaveCount(0);   // ripensamento: non ha aggiunto niente
  await press(page, tile, 1150);
  const sheet = page.getByRole('dialog', { name: 'Birra' });
  await expect(sheet).toBeVisible();
  await expect(page.getByText('Tieni premuto un prodotto per cambiarne la disponibilità.')).toHaveCount(0);   // provato il gesto: il suggerimento sparisce
  await shot(page, 'availability-01-scheda');
  await expect(sheet.getByRole('button', { name: 'Applica' })).toBeDisabled();                                // niente da applicare finché non cambia qualcosa

  await sheet.getByRole('tab', { name: 'Esaurito' }).click();
  await sheet.getByRole('button', { name: 'Applica' }).click();
  await expect(page.getByText('«Birra» segnato esaurito')).toBeVisible();
  await expect(tile).toContainText('Esaurito');
  await expect(otherTile).toContainText('Esaurito', { timeout: 10_000 });
  await shot(page, 'availability-02-esaurito');

  // una tessera esaurita non si ordina, ma si può ancora tenere premuta per rimetterla in vendita (col tasto destro vale subito)
  await tile.click({ force: true });
  await expect(page.getByRole('button', { name: 'Una in meno: Birra' })).toHaveCount(0);
  await tile.click({ button: 'right', force: true });   // «force»: la tessera esaurita è aria-disabled, ma deve ricevere il tasto destro
  const again = page.getByRole('dialog', { name: 'Birra' });
  await again.getByRole('tab', { name: 'Quantità' }).click();
  await again.getByLabel('Quantità rimasta').fill('3');
  await again.getByRole('button', { name: 'Applica' }).click();
  await expect(page.getByText('«Birra»: ne restano 3')).toBeVisible();
  await expect(otherTile).toContainText('3 rimasti', { timeout: 10_000 });

  await tile.click({ button: 'right' });
  const last = page.getByRole('dialog', { name: 'Birra' });
  await last.getByRole('tab', { name: 'Disponibile' }).click();
  await last.getByRole('button', { name: 'Applica' }).click();
  await expect(page.getByText('«Birra» di nuovo disponibile')).toBeVisible();
  await expect(otherTile).not.toContainText('rimasti', { timeout: 10_000 });
});
