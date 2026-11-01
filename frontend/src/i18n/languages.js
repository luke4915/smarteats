// Le lingue dell'interfaccia e come si sceglie quella di partenza. Funzioni pure, provate in languages.test.js.
// L'italiano è la lingua di partenza e quella di riserva: una frase che manca in un'altra lingua si legge in italiano, mai come una chiave.
export const LANGUAGES = [
  { id: 'it', label: 'Italiano' }, { id: 'en', label: 'English' }, { id: 'de', label: 'Deutsch' }, { id: 'fr', label: 'Français' }, { id: 'es', label: 'Español' },
];
export const DEFAULT_LANGUAGE = 'it';

export const isLanguage = (id) => LANGUAGES.some(l => l.id === id);

// La lingua da usare: quella scelta e salvata, altrimenti la prima tra le lingue del telefono che l'app conosce («de-AT» vale «de»), altrimenti l'italiano.
export function pickLanguage(stored, preferred = []) {
  if (isLanguage(stored)) return stored;
  for (const tag of preferred) {
    const base = String(tag).slice(0, 2).toLowerCase();
    if (isLanguage(base)) return base;
  }
  return DEFAULT_LANGUAGE;
}

const fill = (text, params) => text.replace(/\{(\w+)\}/g, (whole, name) => (params[name] === undefined ? whole : String(params[name])));

// Dove una lingua non ha una frase si legge l'inglese e poi l'italiano (le pagine di prenotazione e ordine sono tradotte solo in inglese).
const FALLBACKS = ['en', DEFAULT_LANGUAGE];

// Il testo di una chiave nella lingua scelta. `{nome}` si riempie con `params`; con `params.count` si sceglie `chiave.one` (1) o `chiave.other`.
export function translate(messages, lang, key, params = {}) {
  const plural = params.count === undefined ? null : `${key}.${params.count === 1 ? 'one' : 'other'}`;
  const text = [plural, key].filter(Boolean).map(k => [lang, ...FALLBACKS].map(l => messages[l]?.[k]).find(v => v !== undefined)).find(v => v !== undefined);
  return fill(text ?? key, params);
}
