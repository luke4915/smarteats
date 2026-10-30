import test from 'node:test';
import assert from 'node:assert/strict';
import { boardOrders, ticketMeta, summarize, headline } from './board.js';

const now = new Date('2026-10-29T20:30:00Z').getTime();
const at = (m) => new Date(now - m * 60000).toISOString();
const order = (id, status, ageMin, extra = {}) => ({ id, status, created_at: at(ageMin), items: [], display_code: String(id), ...extra });

test('si vedono solo le comande da fare, dalla più vecchia', () => {
  const list = boardOrders([order(1, 'pending', 5), order(2, 'completed', 30), order(3, 'preparing', 12), order(4, 'canceled', 1), order(5, 'scheduled', 20)]);
  assert.deepEqual(list.map(o => o.id), [3, 1]);
});

test('l\'attesa parte da quando la comanda è uscita, non da quando è stata scritta', () => {
  const o = order(1, 'pending', 40, { fired_at: at(4) });
  assert.equal(ticketMeta(o, now).minutes, 4);
  assert.deepEqual(boardOrders([order(2, 'pending', 3), o]).map(x => x.id), [1, 2], 'si ordina per uscita: quella uscita 4 minuti fa viene prima di quella scritta 3 minuti fa');
});

test('urgenza: verde, ambra da 10 minuti, rosso da 20', () => {
  assert.deepEqual([5, 10, 25].map(m => ticketMeta(order(1, 'pending', m), now).level), ['ok', 'warn', 'late']);
});

test('dove va la comanda: tavolo con coperti, asporto o banco', () => {
  assert.equal(ticketMeta(order(1, 'pending', 1, { table_name: 'T5', covers: 4 }), now).where, 'Tavolo T5 · 4 cop.');
  assert.equal(ticketMeta(order(2, 'pending', 1, { is_takeaway: true }), now).where, 'Asporto');
  assert.equal(ticketMeta(order(3, 'pending', 1, { pickup_at: at(-30) }), now).where, 'Asporto');
  assert.equal(ticketMeta(order(4, 'pending', 1), now).where, 'Banco');
  assert.equal(ticketMeta(order(5, 'pending', 1, { display_code: 'A13' }), now).code, 'A13');
});

test('il riepilogo somma i pezzi per piatto, nota e opzioni, dal più richiesto', () => {
  const rows = summarize([
    order(1, 'pending', 1, { items: [{ name: 'Panino', quantity: 2 }, { name: 'Birra', quantity: 1 }] }),
    order(2, 'pending', 1, { items: [{ name: 'Panino', quantity: 3 }, { name: 'Panino', quantity: 1, note: 'senza cipolla' }, { name: 'Bistecca', quantity: 1, modifiers: ['Al sangue'] }] }),
  ]);
  assert.deepEqual(rows.map(r => [r.name, r.note, r.quantity]), [['Panino', '', 5], ['Birra', '', 1], ['Bistecca', '', 1], ['Panino', 'senza cipolla', 1]].sort((a, b) => b[2] - a[2] || a[0].localeCompare(b[0], 'it')));
  assert.deepEqual(rows.find(r => r.name === 'Bistecca').modifiers, ['Al sangue']);
});

test('titolo: quante comande, quanti pezzi, da quanto aspetta la più vecchia', () => {
  const h = headline([order(1, 'pending', 8, { items: [{ name: 'a', quantity: 2 }] }), order(2, 'preparing', 3, { items: [{ name: 'b', quantity: 1 }] }), order(3, 'completed', 50)], now);
  assert.deepEqual(h, { tickets: 2, pieces: 3, oldest: 8 });
  assert.deepEqual(headline([], now), { tickets: 0, pieces: 0, oldest: 0 });
});
