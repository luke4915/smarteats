import test from 'node:test';
import assert from 'node:assert/strict';
import { fmt, esc, dateAndTime, originOf, givenAway, linesCsv, productsCsv, exportFileName, LINE_HEADERS } from '../utils/sessionExport.js';

test('gli importi si scrivono con la virgola e due decimali', () => {
  assert.equal(fmt(2.5), '2,50');
  assert.equal(fmt('7'), '7,00');
  assert.equal(fmt(null), '0,00');
});

test('un testo che Excel leggerebbe come formula riceve un apostrofo, le virgolette si raddoppiano', () => {
  assert.equal(esc('=SOMMA(A1)'), '"\'=SOMMA(A1)"');
  assert.equal(esc('un "bis"'), '"un ""bis"""');
  assert.equal(esc(null), '""');
});

test('data e ora sono nel fuso del locale, non in UTC', () => {
  // 27 ottobre 2026, 19:35 UTC = 20:35 a Roma (ora solare)
  assert.deepEqual(dateAndTime('2026-10-27T19:35:00Z', 'Europe/Rome'), { date: '27/10/2026', time: '20:35' });
  assert.deepEqual(dateAndTime('2026-10-27T19:35:00Z', 'UTC'), { date: '27/10/2026', time: '19:35' });
});

test('l\'origine è il tavolo, la cassa o l\'asporto', () => {
  assert.equal(originOf({ table_name: '12' }), 'Tavolo 12');
  assert.equal(originOf({ device_letter: 'B' }), 'Cassa B');
  assert.equal(originOf({ is_takeaway: true }), 'Asporto');
  assert.equal(originOf({}), '');
});

test('omaggio e sconto: quanto non è stato incassato rispetto al listino', () => {
  assert.equal(givenAway({ type: 'sale', original_price: 5, quantity: 2, line_total: 10 }), 0);
  assert.equal(givenAway({ type: 'gift', original_price: 5, quantity: 2, line_total: 0 }), 10);
  assert.equal(givenAway({ type: 'discount', original_price: 5, quantity: 2, line_total: 8 }), 2);
  assert.equal(givenAway({ type: 'gift', original_price: null, quantity: 1, line_total: 0 }), 0, 'senza listino noto non si inventa');
});

test('il CSV delle righe ha una riga per riga d\'ordine e le colonne dichiarate', () => {
  const orders = [{
    id: 7, display_code: 'A3', created_at: '2026-10-27T19:35:00Z', total: 9, is_takeaway: false, device_letter: 'A', table_name: null,
    items: [
      { name: 'Panino', category: 'Panini', quantity: 2, price: 4, line_total: 8, type: 'sale', original_price: 4, note: '', modifiers: [{ name: 'Senza cipolla' }] },
      { name: 'Birra', category: 'Bevande', quantity: 1, price: 4, line_total: 1, type: 'discount', original_price: 4, note: 'ghiacciata', modifiers: [] },
    ],
  }];
  const csv = linesCsv(orders, 'Europe/Rome');
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.replace('﻿', '').split('\n');
  assert.equal(lines[0].split(';').length, LINE_HEADERS.length);
  assert.equal(lines.length, 3);
  assert.equal(lines[1], '7;"A3";27/10/2026;20:35;"Cassa A";No;"Panino";"Panini";"Senza cipolla";2;4,00;Vendita;0,00;8,00;"";9,00');
  assert.match(lines[2], /;Sconto;3,00;1,00;"ghiacciata";9,00$/);
});

test('il riepilogo per prodotto parte dal più venduto e calcola il prezzo medio', () => {
  const csv = productsCsv([
    { name: 'Birra', category: 'Bevande', quantity: '3', gifts: '1', revenue: '9' },
    { name: 'Panino', category: 'Panini', quantity: '10', gifts: null, revenue: '40' },
  ]).replace('﻿', '').split('\n');
  assert.equal(csv[1], '"Panino";"Panini";10;0;40,00;4,00');
  assert.equal(csv[2], '"Birra";"Bevande";3;1;9,00;3,00');
});

test('il nome del file è pulito e non vuoto', () => {
  assert.equal(exportFileName('Sagra d\'Ottobre — sabato', 4, 'righe'), 'sagra-d-ottobre-sabato_righe.csv');
  assert.equal(exportFileName(null, 9, 'prodotti'), 'serata-9_prodotti.csv');
  assert.equal(exportFileName('???', 5, 'righe'), 'serata-5_righe.csv');
});
