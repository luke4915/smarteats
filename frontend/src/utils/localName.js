// Il nome di un prodotto nella lingua del cliente: la traduzione se il locale l'ha scritta, altrimenti il nome (in italiano). Provata in localName.test.js.
export const localName = (product, lang) => product.translations?.[lang] || product.name;

// Le lingue in cui un locale può scrivere il nome dei prodotti, con il nome della lingua in italiano (è un campo del personale).
export const TRANSLATION_FIELDS = [{ id: 'en', label: 'Inglese' }, { id: 'de', label: 'Tedesco' }, { id: 'fr', label: 'Francese' }, { id: 'es', label: 'Spagnolo' }];
