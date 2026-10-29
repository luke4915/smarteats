// Il contenuto del report PDF di una serata, già pronto da disegnare: titoli, intestazioni e righe di testo di ogni tabella. Nessuna
// dipendenza dal PDF né dal browser (si prova in reportModel.test.js); `sessionReportPdf.js` lo disegna. I dati arrivano da
// GET /exports/session/:id/report. Solo caratteri che il PDF di base sa scrivere (niente «−»: il meno è «-»).
import { formatEuro, formatElapsed } from '../../../utils/format.js';

const pad = (n) => String(n).padStart(2, '0');
const dayTime = (iso) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const percent = (n) => `${String(n).replace('.', ',')}%`;
const hourRange = (h) => `${pad(h)}:00 - ${pad(h)}:59`;

// «+1,50 €» in più, «-1,50 €» mancano, «0,00 €» quadra.
export function cashDifference(difference) {
  if (difference === null) return 'da contare alla chiusura';
  if (difference === 0) return 'Quadra: nessuna differenza';
  return `${difference > 0 ? '+' : '-'}${formatEuro(Math.abs(difference))} ${difference > 0 ? 'in più del previsto' : 'in meno del previsto'}`;
}

// Le righe di sintesi: sempre le stesse e, per il ristorante, i coperti. `pairs` = [etichetta, valore].
export function summaryPairs(report) {
  const s = report.summary;
  const pairs = [
    ['Incasso totale', formatEuro(s.revenue)],
    ['Ordini', String(s.orders)],
    ['Importo medio per ordine', formatEuro(s.averageOrder)],
    ['Ordini da asporto', String(s.takeawayOrders)],
  ];
  if (s.covers > 0) pairs.push(['Coperti', String(s.covers)], ['Incasso per coperto', formatEuro(s.averagePerCover)]);
  if (s.averageCheckMinutes != null) pairs.push(['Durata media del conto', formatElapsed(s.averageCheckMinutes)]);
  pairs.push(['Ordini annullati', `${s.canceledCount}${s.canceledCount ? ` (${formatEuro(s.canceledTotal)})` : ''}`]);
  pairs.push(['Sconti concessi', formatEuro(s.discountTotal)], ['Omaggi (valore a listino)', formatEuro(s.giftTotal)]);
  return pairs;
}

// Il nome di una cassa o dell'origine degli ordini senza cassa.
const sourceName = (source) => (source ? `Cassa ${source}` : 'Sala, asporto e altro');

// Tutto il report: `noun` è «serata» o «servizio». Le sezioni vuote non compaiono.
export function buildReportModel(report, { noun = 'serata', generatedAt = new Date() } = {}) {
  const { session, locale } = report;
  const period = session.open ? `dal ${dayTime(session.start)} (ancora in corso)` : `dal ${dayTime(session.start)} al ${dayTime(session.end)}`;
  const total = report.summary.revenue;
  const sections = [];
  const add = (title, head, body, extra = {}) => { if (body.length) sections.push({ title, head, body, ...extra }); };

  add('Riepilogo', ['Indicatore', 'Valore'], summaryPairs(report));
  add('Cassa (contanti)', ['Voce', 'Importo'], [
    ['Contanti previsti', formatEuro(report.cash.expected)],
    ['Contanti contati alla chiusura', report.cash.declared === null ? 'non ancora contati' : formatEuro(report.cash.declared)],
    ['Differenza', cashDifference(report.cash.difference)],
  ], { note: 'Nei contanti previsti ci sono gli ordini pagati subito alla cassa e i pagamenti in contanti dei conti; carte e altri metodi non entrano nel cassetto.' });
  add('Incasso per metodo di pagamento', ['Metodo', 'Importo', 'Quota'], report.payments.map(p => [p.label, formatEuro(p.amount), total ? percent(Math.round((p.amount / total) * 1000) / 10) : '-']));
  add('Incasso per categoria', ['Categoria', 'Pezzi', 'Incasso', 'Quota'], report.categories.map(c => [c.category, String(c.quantity), formatEuro(c.revenue), percent(c.share)]));
  add('Tutti i prodotti', ['Prodotto', 'Categoria', 'Pezzi', 'Omaggi', 'Incasso'], report.products.map(p => [p.name, p.category, String(p.quantity), p.gifts ? String(p.gifts) : '-', formatEuro(p.revenue)]));
  add(`Andamento della ${noun}`, ['Fascia oraria', 'Ordini', 'Incasso'], report.byHour.map(h => [hourRange(h.hour), String(h.orders), formatEuro(h.revenue)]));
  if (report.bySource.length > 1 || report.bySource.some(s => s.source)) {
    add('Per cassa', ['Origine', 'Ordini', 'Incasso'], report.bySource.map(s => [sourceName(s.source), String(s.orders), formatEuro(s.revenue)]));
  }
  add('Ordini annullati', ['Codice', 'Ora', 'Importo'], report.canceled.map(c => [c.code || '-', dayTime(c.at).slice(-5), formatEuro(c.total)]),
    { note: report.summary.canceledCount > report.canceled.length ? `Sono elencati i primi ${report.canceled.length} su ${report.summary.canceledCount}.` : undefined });

  return {
    place: locale.name,
    title: `Report della ${noun}${session.name ? `: ${session.name}` : ''}`,
    period,
    generated: `Generato il ${dayTime(generatedAt.toISOString())}`,
    sections,
    fileName: `report_${String(session.name || `${noun}-${session.id}`).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `${noun}-${session.id}`}.pdf`,
  };
}
