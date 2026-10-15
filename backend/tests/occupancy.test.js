import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildOccupancy, buildBookingStats } from '../utils/occupancy.js';

const H = 3600;
// un conto di `covers` persone seduto alle `startMin` (minuti locali) per `minutes`, nel servizio `session`
const check = (session, startMin, minutes, covers, seats = 4) => ({ session_id: session, opened_at: 1000 * H + startMin * 60, closed_at: 1000 * H + (startMin + minutes) * 60, start: startMin, covers, seats });

test('nessun conto: niente numeri, nessuna divisione per zero', () => {
  const o = buildOccupancy({ checks: [], seats: 20, revenue: 0 });
  assert.deepEqual([o.seatOccupancy, o.revpash, o.curve, o.peak], [null, null, [], null]);
  assert.equal(buildOccupancy({ checks: [check(1, 1200, 60, 2)], seats: 0, revenue: 10 }).seatOccupancy, null);
});

test('occupazione: posti-ora usati ÷ posti-ora disponibili del servizio; RevPASH = incasso ÷ stessi posti-ora', () => {
  // servizio dalle 20:00 alle 22:00 (2 ore), 10 posti → 20 posti-ora; usati: 4×1h + 2×2h = 8
  const o = buildOccupancy({ checks: [check(1, 1200, 60, 4), check(1, 1200, 120, 2)], seats: 10, revenue: 200 });
  assert.equal(o.seatOccupancy, 0.4);
  assert.equal(o.revpash, 10);
});

test('più servizi: le ore di servizio si sommano; la curva è una media per servizio', () => {
  const checks = [check(1, 1200, 60, 4), check(2, 1200, 60, 2)];
  const o = buildOccupancy({ checks, seats: 8, revenue: 80 });
  assert.equal(o.seatOccupancy, +(6 / 16).toFixed(3));
  assert.deepEqual(o.curve.map(p => p.seats), [3, 3, 3, 3], 'quattro quarti d\'ora, media di 4 e 2 persone');
  assert.deepEqual(o.peak, { minute: 1200, seats: 3 });
});

test('la curva ha l\'asse continuo e passa la mezzanotte', () => {
  const o = buildOccupancy({ checks: [check(1, 1425, 30, 2), check(1, 30, 15, 6)], seats: 20, revenue: 0 });
  // 23:45 → 00:15 coperto dal primo conto (due persone), 00:30 dal secondo
  assert.equal(o.curve.length, 96, 'dal quarto d\'ora 00:00 a quello delle 23:45, senza buchi');
  assert.deepEqual([o.curve[0], o.curve[1], o.curve[2], o.curve[95]], [{ minute: 0, seats: 2 }, { minute: 15, seats: 0 }, { minute: 30, seats: 6 }, { minute: 1425, seats: 2 }]);
});

test('un conto rimasto aperto più di 6 ore o a zero coperti non conta', () => {
  const o = buildOccupancy({ checks: [check(1, 1200, 400, 4), check(1, 1200, 60, 0), check(1, 1200, 60, 2)], seats: 10, revenue: 30 });
  assert.equal(o.fit.checks, 1);
});

test('abbinamento gruppo-tavolo: coperti ÷ posti, e quanti tavoli avevano almeno 2 posti in più', () => {
  const o = buildOccupancy({ checks: [check(1, 1200, 60, 2, 6), check(1, 1200, 60, 4, 4), check(1, 1300, 60, 3, 4)], seats: 20, revenue: 0 });
  assert.equal(o.fit.rate, +(9 / 14).toFixed(3));
  assert.equal(o.fit.oversized, 1);
});

test('prenotazioni: non presentati sui soli arrivati o assenti, annullati e portale sul totale, anticipo medio', () => {
  assert.equal(buildBookingStats([]), null);
  const b = buildBookingStats([
    { status: 'completed', source: 'portal', party_size: 4, lead_days: 3 },
    { status: 'seated', source: 'staff', party_size: 2, lead_days: 0 },
    { status: 'no_show', source: 'portal', party_size: 2, lead_days: 7 },
    { status: 'cancelled', source: 'portal', party_size: 6, lead_days: 1 },
    { status: 'declined', source: 'portal', party_size: 8, lead_days: 2 },
    { status: 'expired', source: 'portal', party_size: 2, lead_days: 1 },
  ]);
  assert.deepEqual([b.total, b.covers, b.noShowRate, b.cancelRate, b.portalShare, b.declined, b.expired], [6, 8, 0.333, 0.167, 0.833, 1, 1]);
  assert.equal(b.avgLeadDays, 2.3);
});
