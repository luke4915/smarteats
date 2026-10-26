import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

// Magazzino, fase 2: il master sceglie la modalità «magazzino»; l'admin crea ingredienti e la ricetta di un piatto; la cucina trova «Esaurito».
test('magazzino: ingredienti e ricetta di un piatto; la cucina può segnare esaurito', async ({ page, browser }) => {
  const s = seed();
  const slug = s.restaurant.host.split('.')[0];
  const openModules = async () => {
    await page.goto(`${urlOf(s.restaurant.host)}/master`);
    await page.getByLabel('Password master').fill(s.password);
    await page.getByRole('button', { name: 'Entra' }).click();
    await page.getByPlaceholder('Cerca un locale').fill(slug);
    await page.getByRole('article').first().getByRole('button', { name: 'Gestisci' }).click();
    await page.getByRole('tab', { name: 'Moduli' }).click();
  };

  await openModules();
  await page.getByLabel('Magazzino e scorte').check();
  await page.getByRole('tab', { name: 'Magazzino', exact: true }).click();
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Salvato')).toBeVisible();

  const admin = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  await login(admin, s.restaurant.host, s.restaurant.admin);
  await admin.getByRole('link', { name: 'Magazzino' }).click();
  await expect(admin.getByRole('heading', { name: 'Magazzino' })).toBeVisible();

  // ingredienti
  for (const name of ['Farina 00', 'Mozzarella']) {
    await admin.getByRole('button', { name: 'Nuovo ingrediente' }).click();
    await admin.getByPlaceholder('Es. Farina 00').fill(name);
    await admin.getByRole('button', { name: 'Salva', exact: true }).click();
    await expect(admin.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible();
  }
  await shot(admin, 'inventory-03-ingredienti');

  // fornitore e scarico di merce, con la foto della bolla
  await admin.getByRole('tab', { name: 'Fornitori' }).click();
  await admin.getByRole('button', { name: 'Nuovo fornitore' }).click();
  await admin.getByPlaceholder('Es. Rossi Alimentari').fill('Rossi Alimentari');
  await admin.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(admin.getByRole('button', { name: /^Rossi Alimentari/ })).toBeVisible();

  await admin.getByRole('tab', { name: 'Scarichi' }).click();
  await admin.getByRole('button', { name: 'Nuovo scarico' }).click();
  await admin.getByLabel('Fornitore', { exact: true }).selectOption({ label: 'Rossi Alimentari' });
  await admin.getByLabel('Ingrediente', { exact: true }).selectOption({ label: 'Farina 00' });
  await admin.getByLabel('Confezione', { exact: true }).fill('Sacco da 25 kg');
  await admin.getByLabel('Confezioni arrivate').fill('4');
  await admin.getByLabel('Contenuto', { exact: true }).fill('25');
  await admin.getByLabel('Unità di Contenuto').selectOption('kg');
  await admin.getByLabel('Prezzo a confezione').fill('25,00');
  await admin.getByLabel('IVA', { exact: true }).selectOption('4');
  await admin.getByLabel('Allega la bolla').setInputFiles({ name: 'bolla.png', mimeType: 'image/png',
    buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64') });
  await shot(admin, 'inventory-04a-scarico');
  await admin.getByRole('button', { name: 'Registra lo scarico' }).click();
  await expect(admin.getByRole('button', { name: /Rossi Alimentari.*100,00/ })).toBeVisible();
  await admin.getByRole('button', { name: /Rossi Alimentari.*100,00/ }).click();
  await expect(admin.getByRole('link', { name: 'bolla.jpg' })).toBeVisible();
  await shot(admin, 'inventory-04b-scarico-dettaglio');
  await admin.getByRole('button', { name: 'Chiudi', exact: true }).last().click();
  await admin.getByRole('tab', { name: 'Ingredienti' }).click();
  await expect(admin.getByRole('button', { name: /^Farina 00.*100 kg/ })).toBeVisible();

  // ricetta di un piatto: si scrive dalla Carta, dal pulsante «Ricetta» del piatto
  await admin.locator('a[href="/catalog"]').first().click();
  await expect(admin.getByText('Senza ricetta').first()).toBeVisible();
  await admin.getByRole('button', { name: 'Ricetta di Bruschetta' }).click();
  const recipe = admin.getByRole('dialog', { name: /Ricetta · Bruschetta/ });
  await expect(recipe).toBeVisible();
  await recipe.getByRole('button', { name: 'Aggiungi' }).click();
  await recipe.getByLabel('Ingrediente').selectOption({ label: 'Farina 00' });
  await recipe.getByLabel('Quantità', { exact: true }).fill('200');
  await shot(admin, 'inventory-04-ricetta');
  await recipe.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(admin.getByText(/Bruschetta/).first()).toBeVisible();
  await expect(admin.getByText('1 ingrediente')).toBeVisible();
  await shot(admin, 'inventory-04c-carta-con-ricetta');
  await admin.locator('a[href="/inventory"]').first().click();

  // controllo di magazzino: si conta meno di quanto previsto, e la differenza resta scritta
  await admin.getByRole('tab', { name: 'Controlli' }).click();
  await admin.getByRole('button', { name: 'Nuovo controllo' }).click();
  await admin.getByLabel('Farina 00', { exact: true }).fill('99,5');
  await expect(admin.getByText('Manca 500 g')).toBeVisible();
  await shot(admin, 'inventory-06-controllo');
  await admin.getByRole('button', { name: 'Registra il controllo' }).click();
  await expect(admin.getByRole('button', { name: /Fine servizio.*1 differenza/ })).toBeVisible();

  // uno scarto dalla scheda dell'ingrediente (che si trova con la ricerca), con il motivo
  await admin.getByRole('tab', { name: 'Ingredienti' }).click();
  await admin.getByRole('textbox', { name: 'Cerca un ingrediente' }).fill('farin');
  await expect(admin.getByRole('button', { name: /^Mozzarella/ })).toHaveCount(0);
  await admin.getByRole('button', { name: /^Farina 00/ }).click();
  await admin.getByRole('button', { name: 'Registra uno scarto' }).click();
  await admin.getByLabel('Unità di Quantità').selectOption('g');
  await admin.getByLabel('Quantità', { exact: true }).fill('500');
  await admin.getByRole('button', { name: 'Registra', exact: true }).click();
  await admin.getByRole('button', { name: /^Farina 00/ }).click();
  await expect(admin.getByText(/Scarto · Scaduto/)).toBeVisible();                     // negli ultimi movimenti della scheda
  await shot(admin, 'inventory-07-scheda-ingrediente');
  await admin.getByRole('button', { name: 'Annulla' }).click();

  // le statistiche del magazzino stanno in Statistiche, divise in parti
  await admin.locator('a[href="/stats"]').first().click();
  await admin.getByRole('tab', { name: 'Magazzino' }).click();
  await expect(admin.getByText('Food cost', { exact: true })).toBeVisible();
  await shot(admin, 'inventory-08-report');
  await admin.getByRole('tab', { name: 'Scarti e differenze' }).click();
  await expect(admin.getByText('Nessuno scarto registrato')).toHaveCount(0);
  await expect(admin.getByText(/Scaduto/)).toBeVisible();
  await shot(admin, 'inventory-08b-scarti');
  await admin.getByRole('tab', { name: 'Acquisti' }).click();
  await expect(admin.getByText('Rossi Alimentari')).toBeVisible();
  await admin.locator('a[href="/inventory"]').first().click();

  // scorta minima: l'ingrediente va in «Da riordinare» e la campanella lo segnala (dopo una ricarica: la campanella si aggiorna ogni minuto)
  await admin.getByRole('tab', { name: 'Ingredienti' }).click();
  await admin.getByRole('button', { name: /^Farina 00/ }).click();
  await admin.getByLabel('Unità di Scorta minima').selectOption('kg');
  await admin.getByLabel('Scorta minima', { exact: true }).fill('200');
  await admin.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(admin.getByRole('button', { name: /^Farina 00.*Da riordinare/ })).toBeVisible();
  await admin.getByRole('tab', { name: 'Da riordinare (1)' }).click();
  await shot(admin, 'inventory-09-da-riordinare');
  await admin.reload();
  await admin.getByRole('button', { name: /^Notifiche/ }).click();
  await expect(admin.getByRole('menuitem', { name: /Da riordinare · Farina 00/ })).toBeVisible();
  await shot(admin, 'inventory-10-campanella');
  await admin.keyboard.press('Escape');

  // la cucina vede «Esaurito»
  const chef = await (await browser.newContext({ ignoreHTTPSErrors: true })).newPage();
  await login(chef, s.restaurant.host, s.restaurant.kitchen);
  await chef.getByRole('button', { name: 'Segna esaurito' }).click();
  await expect(chef.getByRole('dialog', { name: 'Esaurito' })).toBeVisible();
  await expect(chef.getByRole('switch', { name: 'Bruschetta: disponibile' })).toBeChecked();
  await shot(chef, 'inventory-05-esaurito');

  // la cucina segna finita la farina: in sala il piatto è «Esaurito» e l'amministratore lo vende comunque, dopo la conferma
  await chef.getByRole('tab', { name: 'Ingredienti' }).click();
  await chef.getByRole('switch', { name: 'Farina 00: disponibile' }).click();
  await expect(chef.getByRole('switch', { name: 'Farina 00: disponibile' })).not.toBeChecked();
  await admin.locator('a[href="/floor"]').first().click();
  await admin.getByRole('button', { name: /^T2: Libero/ }).click();
  await admin.getByRole('button', { name: 'Apri tavolo' }).click();
  await admin.getByRole('button', { name: 'Aggiungi' }).click();
  await expect(admin.getByRole('button', { name: /Bruschetta.*Esaurito/ })).toBeVisible();
  await shot(admin, 'inventory-11-esaurito-in-sala');
  await admin.getByRole('button', { name: /Bruschetta/ }).click();
  await admin.getByRole('button', { name: 'Invia in cucina' }).click();
  await expect(admin.getByRole('dialog', { name: 'Ingrediente esaurito' })).toBeVisible();
  await shot(admin, 'inventory-12-vendi-comunque');
  await admin.getByRole('button', { name: 'Vendi comunque' }).click();
  await expect(admin.getByRole('button', { name: 'Incassa' })).toBeVisible();     // la comanda è partita: si è tornati al conto

  // si rimette tutto a posto: conto eliminato (la farina torna in dispensa) e farina di nuovo disponibile
  await admin.getByRole('button', { name: 'Altre azioni' }).click();
  await admin.getByRole('menuitem', { name: 'Elimina conto' }).click();
  await admin.getByRole('button', { name: 'Sì, elimina' }).click();
  await expect(admin.getByRole('button', { name: /^T2: Libero/ })).toBeVisible();
  await chef.getByRole('switch', { name: 'Farina 00: disponibile' }).click();
  await expect(chef.getByRole('switch', { name: 'Farina 00: disponibile' })).toBeChecked();
  await chef.close();
  await admin.close();

  // si rimette com'era
  await openModules();
  await page.getByLabel('Magazzino e scorte').uncheck();
  await page.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Salvato')).toBeVisible();
});
