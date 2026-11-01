// Le traduzioni del nome di un prodotto (lingue dei menu dei clienti, oltre all'italiano). Logica pura, provata in translations.test.js.
export const TRANSLATION_LANGUAGES = ['en', 'de', 'fr', 'es'];
export const MAX_NAME = 40;

// Un oggetto qualsiasi → solo le lingue ammesse, con il testo ripulito; i vuoti spariscono.
export function normalizeTranslations(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const out = {};
  for (const lang of TRANSLATION_LANGUAGES) {
    const text = typeof input[lang] === 'string' ? input[lang].trim().slice(0, MAX_NAME) : '';
    if (text) out[lang] = text;
  }
  return out;
}
