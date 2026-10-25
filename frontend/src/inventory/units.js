// Le unità di misura del magazzino. Il server lavora sempre nell'unità di base dell'ingrediente (g, ml, pc); a schermo si
// scrive e si legge in quella più comoda (200 g, 1,5 kg). Logica pura, provata in units.test.js.

export const BASE_UNITS = { g: 'Grammi', ml: 'Millilitri', pc: 'Pezzi' };

// Ogni unità che si può digitare: a quale unità di base appartiene e per quanto si moltiplica.
const UNITS = {
  g: { base: 'g', factor: 1, label: 'g' },
  kg: { base: 'g', factor: 1000, label: 'kg' },
  ml: { base: 'ml', factor: 1, label: 'ml' },
  cl: { base: 'ml', factor: 10, label: 'cl' },
  l: { base: 'ml', factor: 1000, label: 'l' },
  pc: { base: 'pc', factor: 1, label: 'pz' },
};

// Le unità tra cui scegliere per un ingrediente (l'unità di base per prima).
export const unitsFor = (baseUnit) => Object.entries(UNITS).filter(([, u]) => u.base === baseUnit).map(([id, u]) => ({ id, label: u.label }));

// Un testo scritto a mano («1,5») in numero, o null se non è un numero.
export function parseDecimal(text) {
  const value = Number(String(text).trim().replace(',', '.'));
  return String(text).trim() !== '' && Number.isFinite(value) ? value : null;
}

const round3 = (n) => Math.round(n * 1000) / 1000;

// Da ciò che si è digitato all'unità di base: 1,5 kg → 1500 g.
export const toBaseQuantity = (value, unit) => round3(value * UNITS[unit].factor);

// Dalla quantità di base alla forma più leggibile: { value, unit } (1500 g → 1,5 kg; 800 g → 800 g).
export function toDisplayQuantity(quantity, baseUnit) {
  const choices = unitsFor(baseUnit).map(u => ({ ...u, factor: UNITS[u.id].factor })).sort((a, b) => b.factor - a.factor);
  const pick = choices.find(c => Math.abs(quantity) >= c.factor) ?? choices[choices.length - 1];
  return { value: round3(quantity / pick.factor), unit: pick.id };
}

const NUMBER = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 2 });

// «1,5 kg», «800 g», «3 pz».
export function formatQuantity(quantity, baseUnit) {
  const { value, unit } = toDisplayQuantity(quantity, baseUnit);
  return `${NUMBER.format(value)} ${UNITS[unit].label}`;
}

// Costo di un ingrediente per l'unità più usata: i centesimi per grammo diventano «€/kg».
export function formatCostPerUnit(costPerBaseUnit, baseUnit) {
  const per = baseUnit === 'pc' ? 1 : 1000;
  const label = { g: 'kg', ml: 'l', pc: 'pz' }[baseUnit];
  return `${new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format((costPerBaseUnit * per) / 100)}/${label}`;
}

export const formatCents = (cents) => new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

// «26,4%», o un trattino se non c'è nulla da confrontare.
export const formatPercent = (value) => (value === null || value === undefined ? '—' : `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value)}%`);
