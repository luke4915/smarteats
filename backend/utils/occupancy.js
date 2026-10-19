// Riempimento dei tavoli (statistiche del ristorante): funzioni pure, con test (tests/occupancy.test.js).
// Parte dai conti pagati: quando si sono seduti (`start`, minuti dalla mezzanotte locale), quanto sono rimasti (`minutes`),
// quanti erano (`covers`) e quanti posti aveva il tavolo (`seats`). I posti si contano sul momento: se l'admin cambia
// la sala, le statistiche vecchie si leggono con i posti di oggi.

const BUCKET = 15;                 // minuti per colonna della curva
const MAX_STAY = 360;              // un conto più lungo di 6 ore è dimenticato aperto: non conta
const round = (n, d = 2) => (Number.isFinite(n) ? +n.toFixed(d) : null);

// checks: [{ session_id, opened_at(epoch s), closed_at(epoch s), start(min locali), covers, seats }]
export function buildOccupancy({ checks, seats, revenue }) {
  const valid = checks.filter(c => c.closed_at > c.opened_at && (c.closed_at - c.opened_at) / 60 <= MAX_STAY && Number(c.covers) > 0);
  if (!valid.length || !(seats > 0)) return { seats: Number(seats) || 0, seatOccupancy: null, revpash: null, curve: [], peak: null, fit: { rate: null, oversized: 0, checks: 0 } };

  // Ore di servizio: per ogni servizio dalla prima seduta all'ultima chiusura
  const bySession = new Map();
  for (const c of valid) {
    const cur = bySession.get(c.session_id) ?? { from: Infinity, to: -Infinity };
    cur.from = Math.min(cur.from, c.opened_at); cur.to = Math.max(cur.to, c.closed_at);
    bySession.set(c.session_id, cur);
  }
  // (almeno un'ora per servizio: un servizio di pochi minuti darebbe un RevPASH assurdo)
  const serviceHours = [...bySession.values()].reduce((s, x) => s + Math.max(1, (x.to - x.from) / 3600), 0);

  const seatHours = valid.reduce((s, c) => s + Number(c.covers) * (c.closed_at - c.opened_at) / 3600, 0);
  const available = seats * serviceHours;

  // Curva: posti occupati in ogni quarto d'ora del giorno, in media sui servizi
  const sums = new Map();
  for (const c of valid) {
    const minutes = Math.ceil((c.closed_at - c.opened_at) / 60);
    for (let m = 0; m < minutes; m += BUCKET) {
      const bucket = Math.floor(((Number(c.start) + m) % 1440) / BUCKET) * BUCKET;
      sums.set(bucket, (sums.get(bucket) ?? 0) + Number(c.covers));
    }
  }
  const services = bySession.size;
  const ordered = [...sums.keys()].sort((a, b) => a - b);
  // dalla prima all'ultima fascia, anche quelle intermedie vuote (asse continuo)
  const curve = [];
  if (ordered.length) for (let m = ordered[0]; m <= ordered[ordered.length - 1]; m += BUCKET) curve.push({ minute: m, seats: round((sums.get(m) ?? 0) / services, 1) });
  const peak = curve.reduce((b, p) => (p.seats > (b?.seats ?? 0) ? p : b), null);

  const withTable = valid.filter(c => Number(c.seats) > 0);
  const coversSum = withTable.reduce((s, c) => s + Number(c.covers), 0);
  const seatsSum = withTable.reduce((s, c) => s + Number(c.seats), 0);
  return {
    seats,
    seatOccupancy: round(Math.min(1, seatHours / available), 3),
    revpash: round(Number(revenue) / available),
    curve,
    peak,
    fit: {
      rate: seatsSum ? round(coversSum / seatsSum, 3) : null,
      oversized: withTable.filter(c => Number(c.seats_min ?? c.seats) - Number(c.covers) >= 2).length,
      checks: withTable.length,
    },
  };
}

// reservations: [{ status, source, party_size, lead_days }]
export function buildBookingStats(reservations) {
  const n = reservations.length;
  if (!n) return null;
  const count = (f) => reservations.filter(f).length;
  const came = count(r => ['seated', 'completed'].includes(r.status));
  const noShow = count(r => r.status === 'no_show');
  const lead = reservations.filter(r => Number.isFinite(Number(r.lead_days)) && Number(r.lead_days) >= 0);
  return {
    total: n,
    covers: reservations.filter(r => ['confirmed', 'seated', 'completed', 'no_show'].includes(r.status)).reduce((s, r) => s + Number(r.party_size), 0),
    noShowRate: came + noShow ? round(noShow / (came + noShow), 3) : null,
    cancelRate: round(count(r => r.status === 'cancelled') / n, 3),
    portalShare: round(count(r => r.source === 'portal') / n, 3),
    avgLeadDays: lead.length ? round(lead.reduce((s, r) => s + Number(r.lead_days), 0) / lead.length, 1) : null,
    declined: count(r => r.status === 'declined'),
    expired: count(r => r.status === 'expired'),
  };
}
