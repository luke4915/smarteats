import { test, expect } from '@playwright/test';
import { seed, login, shot, urlOf } from './support.js';

// Il prezzo di un prodotto si guarda nella sua riga: lo stesso importo può comparire su più prodotti (es. due piatti da 14,00 €).
const rowOf = (page, name) => page.getByRole('listitem').filter({ hasText: name });

// Un tentativo fallito a metà lascia il prodotto di prova in carta: il tentativo dopo (retry) si fermerebbe su «già esistente» e nasconderebbe
// l'errore vero. Quindi, se c'è, lo si elimina prima di cominciare.
async function removeLeftover(page, name) {
  const trash = page.getByRole('button', { name: `Elimina ${name}` });
  if (await trash.count() === 0) return;
  await trash.click();
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(trash).toHaveCount(0);
}

// L'editor dei prodotti nelle due versioni: la carta del ristorante (elenco compatto, portata, opzioni) e il listino
// della sagra (elenco per categoria). Stesso modulo e stesse regole: nome unico, quantità valida.
test('carta del ristorante: aggiungo un piatto con portata, provo un doppione, lo modifico, lo nascondo, lo elimino', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Carta' }).click();
  await expect(page.getByText('Spaghetti alle vongole')).toBeVisible();
  await removeLeftover(page, 'Risotto di prova');

  await page.getByRole('button', { name: 'Nuovo piatto' }).click();
  await page.locator('input[name="category"]').fill('Primi');
  await page.locator('input[name="name"]').fill('Risotto di prova');
  await page.locator('input[name="price"]').fill('12,5');
  await page.getByLabel('Portata').selectOption({ label: 'Primi' });
  await shot(page, 'catalog-01-modulo');
  await page.getByRole('button', { name: 'Aggiungi piatto' }).click();
  await expect(page.getByRole('button', { name: 'Modifica Risotto di prova' })).toBeVisible();
  await expect(rowOf(page, 'Risotto di prova').getByText('12,50 €')).toBeVisible();

  // Lo stesso nome nella stessa categoria non si può creare
  await page.getByRole('button', { name: 'Nuovo piatto' }).click();
  await page.locator('input[name="category"]').fill('Primi');
  await page.locator('input[name="name"]').fill('Risotto di prova');
  await page.locator('input[name="price"]').fill('9');
  await page.getByRole('button', { name: 'Aggiungi piatto' }).click();
  await expect(page.getByText('Piatto già esistente')).toBeVisible();
  await page.getByRole('button', { name: 'Ho capito' }).click();
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();     // il modulo ha «Annulla», non la X

  // Modifica del prezzo
  await page.getByRole('button', { name: 'Modifica Risotto di prova' }).click();
  await page.locator('input[name="price"]').fill('14');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(rowOf(page, 'Risotto di prova').getByText('14,00 €')).toBeVisible();

  // L'interruttore «Visibile» nasconde dalla cassa, ma il piatto resta in elenco (in grigio, «Nascosto») e il filtro lo trova
  const visible = page.getByRole('switch', { name: 'Visibile: Risotto di prova' });
  await expect(visible).toHaveAttribute('aria-checked', 'true');
  await visible.click();
  await expect(visible).toHaveAttribute('aria-checked', 'false');
  await expect(page.getByRole('listitem').filter({ hasText: 'Risotto di prova' })).toContainText('Nascosto');
  await page.getByRole('tab', { name: /^Nascosti/ }).click();
  await expect(page.getByRole('button', { name: 'Modifica Risotto di prova' })).toBeVisible();
  await page.getByRole('tab', { name: 'Visibili' }).click();
  await expect(page.getByRole('button', { name: 'Modifica Risotto di prova' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Tutti', exact: true }).click();
  await shot(page, 'catalog-03-nascosto');

  // «Elimina» è il cestino della riga e chiede sempre conferma (la modifica è il tocco sulla riga)
  await page.getByRole('button', { name: 'Elimina Risotto di prova' }).click();
  await expect(page.getByText('Eliminare «Risotto di prova»?')).toBeVisible();
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Modifica Risotto di prova' })).toHaveCount(0);
});

test('listino della sagra: aggiungo un prodotto con disponibilità limitata e lo elimino', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await page.goto(`${page.url().split('/').slice(0, 3).join('/')}/config`);
  await expect(page.getByText('Panino con salsiccia')).toBeVisible();
  await removeLeftover(page, 'Panino di prova');
  await shot(page, 'catalog-02-listino-sagra');

  // Un'altra cassa già aperta: vede nascere e sparire il prodotto senza ricaricare
  const other = await page.context().newPage();
  await other.goto(`${urlOf(festival.host)}/`);
  await expect(other.getByRole('button', { name: /^Panino con salsiccia/ })).toBeVisible();

  await page.getByRole('button', { name: 'Nuovo prodotto' }).click();
  await page.locator('input[name="category"]').fill('Panini');
  await page.locator('input[name="name"]').fill('Panino di prova');
  await page.locator('input[name="price"]').fill('6');
  await page.getByRole('switch', { name: 'Disponibilità limitata' }).click();
  // Senza una quantità il salvataggio resta bloccato
  await expect(page.getByRole('button', { name: 'Aggiungi prodotto' })).toBeDisabled();
  await page.locator('input[name="stock"]').fill('10');
  await page.getByRole('button', { name: 'Aggiungi prodotto' }).click();
  await expect(page.getByRole('button', { name: 'Modifica Panino di prova' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifica Panino di prova' })).toHaveCount(1);          // chi l'ha creato non lo vede doppio
  await expect(other.getByRole('button', { name: /^Panino di prova/ })).toBeVisible({ timeout: 10_000 });

  await page.getByRole('button', { name: 'Elimina Panino di prova' }).click();
  await page.getByRole('button', { name: 'Elimina', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Modifica Panino di prova' })).toHaveCount(0);
  await expect(other.getByRole('button', { name: /^Panino di prova/ })).toHaveCount(0, { timeout: 10_000 });
});

// Dalla riga del Menu si cambia la disponibilità (la stessa scheda della cassa) e il filtro «Esauriti» compare da solo.
test('listino della sagra: la disponibilità si cambia dalla riga e compare il filtro «Esauriti»', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await page.goto(`${page.url().split('/').slice(0, 3).join('/')}/config`);
  await expect(page.getByRole('tab', { name: /^Esauriti/ })).toHaveCount(0);                          // nessun esaurito: nessun filtro
  await page.getByRole('button', { name: /^Disponibilità di Birra/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Birra' });
  await sheet.getByRole('tab', { name: 'Esaurito' }).click();
  await sheet.getByRole('button', { name: 'Applica' }).click();
  await expect(page.getByRole('button', { name: 'Disponibilità di Birra: Esaurito' })).toBeVisible();
  await page.getByRole('tab', { name: 'Esauriti 1' }).click();
  await expect(page.getByRole('button', { name: 'Modifica Birra' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Modifica Acqua' })).toHaveCount(0);
  await shot(page, 'catalog-05-esauriti');
  await page.getByRole('button', { name: /^Disponibilità di Birra/ }).click();                       // di nuovo in vendita
  await page.getByRole('dialog', { name: 'Birra' }).getByRole('tab', { name: 'Disponibile' }).click();
  await page.getByRole('dialog', { name: 'Birra' }).getByRole('button', { name: 'Applica' }).click();
  await expect(page.getByRole('tab', { name: /^Esauriti/ })).toHaveCount(0);                          // finiti gli esauriti, il filtro sparisce
});

// Due amministratori sulla stessa carta: l'elenco segue l'altro e il modulo aperto avvisa se tocca lo stesso piatto.
test('carta del ristorante: un altro amministratore cambia il piatto che sto modificando', async ({ page }) => {
  const { restaurant: r } = seed();
  await login(page, r.host, r.admin);
  await page.getByRole('link', { name: 'Carta' }).click();
  await expect(page.getByRole('button', { name: 'Modifica Bruschetta' })).toBeVisible();
  const second = await page.context().newPage();                                                      // l'altro amministratore (stessa sessione, altro dispositivo)
  await second.goto(`${urlOf(r.host)}/catalog`);
  await expect(second.getByRole('button', { name: 'Modifica Bruschetta' })).toBeVisible();

  await page.getByRole('button', { name: 'Modifica Bruschetta' }).click();
  const original = await page.locator('input[name="price"]').inputValue();
  await second.getByRole('button', { name: 'Modifica Bruschetta' }).click();
  await second.locator('input[name="price"]').fill('7');
  await second.getByRole('button', { name: 'Salva modifiche' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Un altro utente ha cambiato questo piatto (prezzo)' })).toBeVisible({ timeout: 10_000 });
  await shot(page, 'catalog-06-conflitto');
  await page.getByRole('button', { name: 'Usa i valori aggiornati' }).click();
  await expect(page.locator('input[name="price"]')).toHaveValue(/^7([.,]00)?$/);
  await expect(page.getByRole('alert').filter({ hasText: 'Un altro utente' })).toHaveCount(0);        // aggiornato: niente più avviso

  // lo stesso piatto eliminato dall'altro: non si può più salvare
  await page.getByRole('button', { name: 'Annulla', exact: true }).click();
  await second.getByRole('button', { name: 'Modifica Bruschetta' }).click();
  await second.locator('input[name="price"]').fill(original);                                          // si rimette il prezzo di prima
  await second.getByRole('button', { name: 'Salva modifiche' }).click();
  await expect(page.getByRole('button', { name: 'Modifica Bruschetta' })).toBeVisible();
});

// «Seleziona»: si sceglie una categoria e «Tutti» spunta quelle in elenco; la barra in fondo dice quanti sono e nasconde o mostra tutti insieme; poi si rimette tutto.
test('listino della sagra: «Seleziona» nasconde e mostra una categoria intera', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  await page.goto(`${page.url().split('/').slice(0, 3).join('/')}/config`);
  await expect(page.getByText('Panino con salsiccia')).toBeVisible();

  await page.getByRole('button', { name: 'Seleziona', exact: true }).click();
  const bar = page.getByRole('toolbar', { name: 'Selezione' });
  await expect(bar).toContainText('Tocca i prodotti da cambiare');
  await expect(bar.getByRole('button', { name: 'Nascondi' })).toBeDisabled();

  await page.getByRole('tablist', { name: 'Categorie' }).getByRole('tab', { name: 'Bevande' }).click();
  await bar.getByRole('button', { name: 'Tutti' }).click();
  await expect(bar).toContainText('2 selezionati');
  await shot(page, 'catalog-04-seleziona');
  await bar.getByRole('button', { name: 'Nascondi' }).click();
  await expect(page.getByRole('toolbar', { name: 'Selezione' })).toHaveCount(0);       // finita l'operazione si esce dalla selezione
  await expect(page.getByRole('tab', { name: /^Nascosti/ })).toBeVisible();            // ora il filtro dei nascosti esiste
  await expect(page.getByRole('switch', { name: 'Visibile: Birra' })).toHaveAttribute('aria-checked', 'false');

  // «Tutti» sceglie quelli in elenco e «Mostra» rimette in vista
  await page.getByRole('tab', { name: /^Nascosti/ }).click();
  await page.getByRole('button', { name: 'Seleziona', exact: true }).click();
  await page.getByRole('toolbar', { name: 'Selezione' }).getByRole('button', { name: 'Tutti' }).click();
  await page.getByRole('toolbar', { name: 'Selezione' }).getByRole('button', { name: 'Mostra' }).click();
  await expect(page.getByRole('tab', { name: /^Nascosti/ })).toHaveCount(0);           // niente più nascosti: il filtro sparisce
  await expect(page.getByRole('switch', { name: 'Visibile: Birra' })).toHaveAttribute('aria-checked', 'true');
});

// L'ordine delle categorie lo sceglie il locale: si riordinano dal Menu e le tessere dei filtri in cassa (anche su un altro dispositivo) lo seguono.
test('listino della sagra: si riordinano le categorie e la cassa le segue', async ({ page }) => {
  const { festival } = seed();
  await login(page, festival.host, festival.admin);
  const other = await page.context().newPage();                                                       // un'altra cassa, già aperta
  await other.goto(`${urlOf(festival.host)}/`);
  const cassaTabs = other.getByRole('tablist', { name: 'Categoria' }).getByRole('tab');
  await expect(cassaTabs.nth(1)).toHaveText('Bevande');                                               // di partenza: alfabetico

  await page.goto(`${page.url().split('/').slice(0, 3).join('/')}/config`);
  const menuTabs = page.getByRole('tablist', { name: 'Categorie' }).getByRole('tab');
  await expect(menuTabs.nth(1)).toHaveText('Bevande');
  await page.getByRole('button', { name: 'Riordina le categorie' }).click();
  const dialog = page.getByRole('dialog', { name: 'Ordine delle categorie' });
  await expect(dialog.getByRole('button', { name: 'Salva' })).toBeDisabled();                         // finché non cambia niente
  const handles = dialog.getByRole('button', { name: 'Trascina per riordinare' });
  await handles.last().focus();                                                                       // «Panini» in fondo: con le frecce sale in cima
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowUp');
  await shot(page, 'catalog-07-ordine-categorie');
  await dialog.getByRole('button', { name: 'Salva' }).click();
  await expect(page.getByText('Ordine delle categorie salvato')).toBeVisible();

  await expect(menuTabs.nth(1)).toHaveText('Panini');                                                 // il Menu
  await expect(cassaTabs.nth(1)).toHaveText('Panini', { timeout: 10_000 });                           // la cassa, senza ricaricare

  // si rimette com'era
  await page.getByRole('button', { name: 'Riordina le categorie' }).click();
  await page.getByRole('dialog', { name: 'Ordine delle categorie' }).getByRole('button', { name: 'Trascina per riordinare' }).first().focus();
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.getByRole('dialog', { name: 'Ordine delle categorie' }).getByRole('button', { name: 'Salva' }).click();
  await expect(menuTabs.nth(1)).toHaveText('Bevande');
  await expect(cassaTabs.nth(1)).toHaveText('Bevande', { timeout: 10_000 });
});

