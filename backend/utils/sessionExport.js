// Esportazioni di una serata in CSV: costruzione del testo, senza database (funzioni pure, provate in tests/sessionExport.test.js).
// Formato pensato per Excel in italiano: separatore «;», decimali con la virgola, UTF-8 con BOM, data e ora nel fuso del locale.

export const fmt = (n) => Number(n || 0).toFixed(2).replace('.', ',');

// Valori che iniziano con = + - @ (o tab/CR) Excel li legge come formule: si antepone un apostrofo.
export const esc = (s) => {
  const text = String(s ?? '');
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const KIND = { sale: 'Vendita', gift: 'Omaggio', discount: 'Sconto' };

// «27/10/2026» e «20:35» di un istante, nel fuso `tz` (il server gira in UTC: senza fuso le ore sarebbero sbagliate).
export function dateAndTime(value, tz) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('it-IT', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date(value)).map(p => [p.type, p.value]));
  return { date: `${parts.day}/${parts.month}/${parts.year}`, time: `${parts.hour}:${parts.minute}` };
}

// Da dove arriva l'ordine: tavolo, lettera della cassa oppure asporto.
export function originOf(order) {
  if (order.table_name) return `Tavolo ${order.table_name}`;
  if (order.device_letter) return `Cassa ${order.device_letter}`;
  return order.is_takeaway ? 'Asporto' : '';
}

// Quanto si è rinunciato a incassare su una riga: l'intero valore per un omaggio, la differenza dal listino per uno sconto.
export const givenAway = (item) => (item.type === 'sale' || item.original_price == null ? 0
  : Math.max(0, Number(item.original_price) * Number(item.quantity) - Number(item.line_total)));

export const LINE_HEADERS = ['Ordine', 'Codice', 'Data', 'Ora', 'Origine', 'Asporto', 'Prodotto', 'Categoria', 'Opzioni', 'Quantità',
  'Prezzo unitario', 'Tipo', 'Sconto o omaggio', 'Importo riga', 'Nota', 'Totale ordine'];

// Una riga di CSV per ogni riga d'ordine. `orders` portano `items` (come le restituisce withItems) più `table_name` e `device_letter`.
export function linesCsv(orders, tz) {
  const lines = [LINE_HEADERS.join(';')];
  for (const order of orders) {
    const { date, time } = dateAndTime(order.created_at, tz);
    for (const item of order.items) {
      const qty = Number(item.quantity || 0);
      lines.push([
        order.id, esc(order.display_code), date, time, esc(originOf(order)), order.is_takeaway ? 'Sì' : 'No',
        esc(item.name), esc(item.category || 'Generico'), esc((item.modifiers ?? []).map(m => m.name).join(' + ')), qty,
        fmt(item.price), KIND[item.type] ?? 'Vendita', fmt(givenAway(item)), fmt(item.line_total ?? qty * Number(item.price || 0)),
        esc(item.note), fmt(order.total),
      ].join(';'));
    }
  }
  return `﻿${lines.join('\n')}`;
}

export const PRODUCT_HEADERS = ['Prodotto', 'Categoria', 'Quantità', 'Di cui omaggi', 'Incasso', 'Prezzo medio'];

// Il riepilogo per prodotto: una riga per prodotto (non per nome), dal più venduto. `rows` arrivano da loadProductTotals.
export function productsCsv(rows) {
  const lines = [PRODUCT_HEADERS.join(';')];
  for (const r of [...rows].sort((a, b) => Number(b.quantity) - Number(a.quantity) || String(a.name).localeCompare(String(b.name), 'it'))) {
    const qty = Number(r.quantity);
    lines.push([esc(r.name), esc(r.category || 'Generico'), qty, Number(r.gifts || 0), fmt(r.revenue), fmt(qty ? Number(r.revenue) / qty : 0)].join(';'));
  }
  return `﻿${lines.join('\n')}`;
}

// Nome del file: «serata-sagra-di-ottobre_righe.csv». Solo lettere e cifre, mai caratteri che i sistemi operativi rifiutano.
export function exportFileName(sessionName, sessionId, kind) {
  const slug = String(sessionName || `serata-${sessionId}`).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || `serata-${sessionId}`}_${kind}.csv`;
}
