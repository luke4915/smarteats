// Calcoli sui contanti ricevuti in cassa, senza React. L'importo si tiene come testo («25», «25.5»), come nel campo
// «Ricevuti»: qui si converte in centesimi interi per sommare senza errori di virgola mobile.

// I tagli dei tasti rapidi: ogni tocco si somma a quanto già ricevuto (20 e poi 5 fanno 25).
export const QUICK_CASH = [5, 10, 20, 50];

const toCents = (text) => Math.round((parseFloat(String(text ?? '').replace(',', '.')) || 0) * 100);

const fromCents = (cents) => {
  const value = (cents / 100).toFixed(2);
  return value.replace(/\.?0+$/, '');
};

// Aggiunge un taglio a ciò che è già stato ricevuto: addCash('20', 5) → '25'.
export function addCash(received, amount) {
  return fromCents(toCents(received) + Math.round(amount * 100));
}

// Il testo dell'importo esatto del totale (per il tasto «Esatto»).
export function exactCash(total) {
  return fromCents(Math.round(total * 100));
}
