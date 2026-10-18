// Logica pura della console master: stato della licenza di un locale, conteggi per filtro, ricerca, indirizzo.
// Sta fuori dalla grafica così si prova con dei test (licenseStatus.test.js).
const DAY = 1000 * 60 * 60 * 24;

// Stato della licenza: `kind` serve ai filtri, `label` e `dot` alla riga.
export const licenseStatus = (t, now = Date.now()) => {
  if (!t.active) return { kind: 'off', label: 'Disattivato', dot: 'bg-gray-400' };
  if (!t.expires_at) return { kind: 'ok', label: 'Senza scadenza', dot: 'bg-blue-500' };
  const daysLeft = (new Date(t.expires_at) - now) / DAY;
  const until = new Date(t.expires_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' });
  if (daysLeft < 0) return { kind: 'expired', label: `Scaduto il ${until}`, dot: 'bg-red-500' };
  if (daysLeft < 3) return { kind: 'soon', label: `Scade ${daysLeft < 1 ? 'oggi' : `tra ${Math.ceil(daysLeft)} giorni`} · ${until}`, dot: 'bg-orange-500' };
  return { kind: 'ok', label: `Attivo fino al ${until}`, dot: 'bg-green-500' };
};

export const FILTERS = [['all', 'Tutti'], ['ok', 'Attivi'], ['soon', 'In scadenza'], ['expired', 'Scaduti'], ['off', 'Disattivati']];
export const LICENSE_PRESETS = [7, 30, 90, 365];

// Quanti locali per ogni filtro (`all` = tutti).
export function countByKind(tenants, now) {
  const counts = { all: tenants.length };
  for (const t of tenants) { const k = licenseStatus(t, now).kind; counts[k] = (counts[k] ?? 0) + 1; }
  return counts;
}

// I locali da mostrare: per filtro e per testo cercato (nome o indirizzo).
export const filterTenants = (tenants, filter, query, now) => tenants.filter(t =>
  (filter === 'all' || licenseStatus(t, now).kind === filter)
  && (!query.trim() || `${t.name} ${t.slug}`.toLowerCase().includes(query.trim().toLowerCase())));

// Dal nome all'indirizzo del locale: minuscolo, senza accenti, trattini al posto di tutto il resto.
export const slugify = (text) => text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);

// Indirizzo del locale: il suo sottodominio sul dominio dell'app (`appDomain`, dal server), con protocollo e porta della console.
export const addressOf = (slug, appDomain, location = window.location) =>
  `${location.protocol}//${slug}.${appDomain}${location.port ? `:${location.port}` : ''}`;
