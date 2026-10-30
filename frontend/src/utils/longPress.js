// Le regole di una pressione lunga su una tessera, senza grafica (provate in longPress.test.js).
//   - dopo `LONG_PRESS_MS` (1 secondo) scatta l'azione «rapida» (la disponibilità del prodotto);
//   - la tessera comincia a riempirsi solo dopo `SHOW_AFTER_MS`: un tocco normale non deve far lampeggiare nulla;
//   - un tocco che dura meno di `CANCEL_AFTER_MS` conta come tocco normale (anche un dito lento aggiunge il prodotto);
//     oltre, rilasciare prima dello scatto è un ripensamento e il tocco non vale niente.
export const LONG_PRESS_MS = 1000;
const SHOW_AFTER_MS = 250;
const CANCEL_AFTER_MS = 500;

// Da 0 a 100: quanto della tessera va riempito dopo `elapsed` millisecondi di pressione.
export const pressProgress = (elapsed, delay = LONG_PRESS_MS) => (elapsed < SHOW_AFTER_MS ? 0 : Math.min(100, (elapsed / delay) * 100));

export const pressFired = (elapsed, delay = LONG_PRESS_MS) => elapsed >= delay;

// Vero se il «click» che segue il rilascio non deve eseguire il tocco normale (prodotto aggiunto): la pressione è scattata o era un ripensamento.
export const pressSwallowsClick = (elapsed) => elapsed >= CANCEL_AFTER_MS;
