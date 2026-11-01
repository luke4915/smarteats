// I conti del confronto tra due serate, senza grafica: variazioni, ordinamento dei prodotti, scelta delle due serate di partenza.
// Funzioni pure, provate in compareData.test.js. «A» è la serata di riferimento (di solito la precedente), «B» quella confrontata.

// Variazione da A a B: differenza e percentuale (null se A è zero, dove una percentuale non ha senso).
export function change(a, b) {
  const delta = Math.round((b - a) * 100) / 100;
  return { delta, percent: a > 0 ? Math.round(((b - a) / a) * 1000) / 10 : null, direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
}

// «+12,5 %», «−8 %», «nuovo» se A era zero e B no, «—» se non cambia nulla.
export function percentText({ percent, direction }) {
  if (direction === 'flat') return '—';
  if (percent === null) return direction === 'up' ? 'nuovo' : '—';
  return `${percent > 0 ? '+' : '−'}${Math.abs(percent).toLocaleString('it-IT', { maximumFractionDigits: 1 })} %`;
}

// I prodotti per il confronto, nella metrica scelta (`qty` o `revenue`) e nell'ordine scelto:
//   `change` = quelli che sono cambiati di più (in valore assoluto), `best` = i più venduti nelle due serate insieme.
// `query` filtra per nome. Ogni prodotto porta `valueA`, `valueB` e `delta`.
export function rankProducts(products, { metric = 'qty', order = 'change', query = '' } = {}) {
  const term = query.trim().toLowerCase();
  return products
    .filter(p => !term || p.name.toLowerCase().includes(term))
    .map(p => ({ ...p, valueA: p.a[metric], valueB: p.b[metric], delta: p.b[metric] - p.a[metric] }))
    .sort((x, y) => (order === 'change'
      ? Math.abs(y.delta) - Math.abs(x.delta)
      : (y.valueA + y.valueB) - (x.valueA + x.valueB)) || x.name.localeCompare(y.name, 'it'));
}

// Le due serate di partenza: B l'ultima conclusa e A quella prima (le più recenti sono in testa all'elenco). Con meno di due, nulla.
export function defaultPair(sessions) {
  const done = sessions.filter(s => s.end_time);
  const pool = done.length >= 2 ? done : sessions;
  return pool.length >= 2 ? { a: pool[1].id, b: pool[0].id } : null;
}

// Quanto pesa una variazione sul totale delle due serate: serve a non mostrare in cima variazioni minuscole (da 1 a 2 pezzi).
export const isNoise = (p, metric = 'qty') => (p.a[metric] + p.b[metric]) < (metric === 'qty' ? 3 : 5);
