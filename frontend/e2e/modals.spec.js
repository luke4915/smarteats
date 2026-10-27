import { test, expect } from '@playwright/test';
import { seed, login, urlOf, shot } from './support.js';

// La conferma di uscita è nella cassa delle sagre (nel ristorante si esce subito). Le finestre sono schede sopra tutta la pagina: coprono ogni cosa (menu e testata compresi, non solo l'area di lavoro),
// stanno sempre dentro lo schermo e hanno una sola uscita visibile: con i pulsanti in fondo c'è «Annulla» e non la X;
// senza, c'è la X. Sul telefono salgono dal basso e si appoggiano al bordo.
const inside = (box, view) => box.x >= -0.5 && box.y >= -0.5 && box.x + box.width <= view.width + 0.5 && box.y + box.height <= view.height + 0.5;

const openLogout = async (page) => {
  await page.getByRole('button', { name: /^Account/ }).click();
  await page.getByRole('button', { name: 'Esci', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: "Uscire dall'account?" });
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(450);                            // finita l'entrata
  return dialog;
};

test('finestre su portatile: sfondo su tutto lo schermo, una sola uscita', async ({ page }) => {
  const { festival, restaurant: r } = seed();
  await login(page, festival.host, festival.admin);
  const view = page.viewportSize();
  const dialog = await openLogout(page);

  const backdrop = await dialog.locator('xpath=..').boundingBox();
  expect(backdrop, 'lo sfondo copre menu e testata').toEqual({ x: 0, y: 0, width: view.width, height: view.height });
  expect(inside(await dialog.boundingBox(), view)).toBe(true);
  await expect(dialog.getByRole('button', { name: 'Chiudi' })).toHaveCount(0);       // c'è «Annulla»: niente X
  await shot(page, 'modals-01-conferma');
  await dialog.getByRole('button', { name: 'Annulla' }).click();
  await expect(dialog).toHaveCount(0);

  // senza pulsanti in fondo l'uscita è la X (qui la finestra di un locale nella console master)
  await page.goto(`${urlOf(r.host)}/master`);
  await page.getByLabel('Password master').fill(seed().password);
  await page.getByRole('button', { name: 'Entra' }).click();
  await page.getByPlaceholder('Cerca un locale').fill(r.host.split('.')[0]);
  await page.getByRole('article').first().getByRole('button', { name: 'Gestisci' }).click();
  const manage = page.getByRole('dialog').first();
  await expect(manage.getByRole('button', { name: 'Chiudi', exact: true })).toBeVisible();
  expect(inside(await manage.boundingBox(), view)).toBe(true);
});

test.describe('telefono', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('finestre sul telefono: scheda dal basso, a tutta larghezza', async ({ page }) => {
    const { festival } = seed();
    await login(page, festival.host, festival.admin);
    const view = page.viewportSize();
    const dialog = await openLogout(page);
    const box = await dialog.boundingBox();
    expect(box.width, 'a tutta larghezza').toBeCloseTo(view.width, 0);
    expect(box.y + box.height, 'appoggiata al bordo basso').toBeCloseTo(view.height, 0);
    await expect(dialog.getByRole('button', { name: 'Chiudi' })).toHaveCount(0);
    for (const name of ['Annulla', 'Esci']) expect((await dialog.getByRole('button', { name }).boundingBox()).height, `${name}: bersaglio da dito`).toBeGreaterThanOrEqual(44);
    await shot(page, 'modals-02-telefono');

    // si chiude trascinandola verso il basso dalla maniglia; un trascinamento breve la lascia dov'è
    const handle = { x: box.x + box.width / 2, y: box.y + 8 };
    await page.mouse.move(handle.x, handle.y); await page.mouse.down(); await page.mouse.move(handle.x, handle.y + 50, { steps: 5 }); await page.mouse.up();
    await page.waitForTimeout(400);
    expect((await dialog.boundingBox()).y, 'un trascinamento breve non la chiude').toBeCloseTo(box.y, 0);
    await page.mouse.move(handle.x, handle.y); await page.mouse.down(); await page.mouse.move(handle.x, handle.y + 220, { steps: 8 }); await page.mouse.up();
    await expect(dialog).toHaveCount(0);
  });
});
