// Il contenuto del report PDF di una serata, già pronto da disegnare: titoli, intestazioni e righe di testo di ogni tabella. Nessuna
// dipendenza dal PDF né dal browser (si prova in reportModel.test.js); `sessionReportPdf.js` lo disegna. I dati arrivano da
// GET /exports/session/:id/report. Solo caratteri che il PDF di base sa scrivere (niente «−»: il meno è «-»).
import { formatEuro as euro, formatElapsed } from '../../../utils/format.js';

// Nel PDF il simbolo dell'euro è più largo di quanto il programma calcoli: senza uno spazio in più il testo che segue lo copre.
const formatEuro = (n) => euro(n).replace('\u20ac', '\u20ac ');

const pad = (n) => String(n).padStart(2, '0');
const dayTime = (iso) => { const d = new Date(iso); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const percent = (n) => `${String(n).replace('.', ',')}%`;

// «+1,50 €» in più, «-1,50 €» mancano, «0,00 €» quadra.
export function cashDifference(difference) {
  if (difference === null) return 'da contare alla chiusura';
  if (difference === 0) return 'Quadra: nessuna differenza';
  return `${difference > 0 ? '+' : '-'}${formatEuro(Math.abs(difference))} ${difference > 0 ? 'in più del previsto' : 'in meno del previsto'}`;
}

// Le quattro cifre grandi in cima al foglio: incasso, ordini, importo medio e (al ristorante) incasso per coperto, sulla sagra l'asporto.
export function kpiCards(report) {
  const s = report.summary;
  return [
    { label: 'Incasso', value: formatEuro(s.revenue) },
    { label: 'Ordini', value: String(s.orders) },
    { label: 'Importo medio', value: formatEuro(s.averageOrder) },
    s.covers > 0 ? { label: 'Incasso per coperto', value: formatEuro(s.averagePerCover) } : { label: 'Da asporto', value: String(s.takeawayOrders) },
  ];
}

// Gli altri indicatori, in tabella: coperti e durata (ristorante), annullati, sconti e omaggi. `pairs` = [etichetta, valore].
export function summaryPairs(report) {
  const s = report.summary;
  const pairs = [];
  if (s.covers > 0) pairs.push(['Coperti', String(s.covers)], ['Ordini da asporto', String(s.takeawayOrders)]);
  if (s.averageCheckMinutes != null) pairs.push(['Durata media del conto', formatElapsed(s.averageCheckMinutes)]);
  pairs.push(['Ordini annullati', `${s.canceledCount}${s.canceledCount ? ` (${formatEuro(s.canceledTotal)})` : ''}`]);
  pairs.push(['Sconti concessi', formatEuro(s.discountTotal)], ['Omaggi (valore a listino)', formatEuro(s.giftTotal)]);
  return pairs;
}

// La scatola della cassa: previsto, contato e differenza, con il tono (verde se quadra o avanza, rosso se mancano soldi, neutro se non è chiusa).
export function cashBox(report) {
  const { expected, declared, difference } = report.cash;
  return {
    title: 'Cassa (contanti)',
    expected: formatEuro(expected),
    declared: declared === null ? 'da contare' : formatEuro(declared),
    verdict: cashDifference(difference),
    tone: difference === null ? 'neutral' : difference < 0 ? 'bad' : 'good',
  };
}

// Il nome di una cassa o dell'origine degli ordini senza cassa.
const sourceName = (source) => (source ? `Cassa ${source}` : 'Sala, asporto e altro');

// I grafici: ogni riga ha etichetta, valore (per la lunghezza della barra) e il testo da scrivere accanto.
export function chartsOf(report, noun = 'serata') {
  const total = report.summary.revenue;
  const charts = [];
  if (report.payments.length) {
    charts.push({ id: 'payments', type: 'split', title: 'Come hanno pagato', rows: report.payments.map(p => ({ label: p.label, value: p.amount, text: `${formatEuro(p.amount)}${total ? ` · ${percent(Math.round((p.amount / total) * 1000) / 10)}` : ''}` })) });
  }
  if (report.categories.length) {
    charts.push({ id: 'categories', type: 'bars', title: 'Incasso per categoria', rows: report.categories.slice(0, 8).map(c => ({ label: c.category, value: c.revenue, text: `${formatEuro(c.revenue)} · ${percent(c.share)}` })) });
  }
  if (report.byHour.length) {
    charts.push({ id: 'hours', type: 'columns', title: `Incasso per ora (${noun})`, rows: report.byHour.map(h => ({ label: pad(h.hour), value: h.revenue, text: `${h.orders} ord.` })) });
  }
  return charts;
}

// Tutto il report: `noun` è «serata» o «servizio». Le sezioni vuote non compaiono.
export function buildReportModel(report, { noun = 'serata', generatedAt = new Date() } = {}) {
  const { session, locale } = report;
  const period = session.open ? `dal ${dayTime(session.start)} (ancora in corso)` : `dal ${dayTime(session.start)} al ${dayTime(session.end)}`;
  const sections = [];
  const add = (title, head, body, extra = {}) => { if (body.length) sections.push({ title, head, body, ...extra }); };

  add('Altri indicatori', ['Indicatore', 'Valore'], summaryPairs(report));
  add('Tutti i prodotti', ['Prodotto', 'Categoria', 'Pezzi', 'Omaggi', 'Incasso'], report.products.map(p => [p.name, p.category, String(p.quantity), p.gifts ? String(p.gifts) : '-', formatEuro(p.revenue)]));
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
    kpis: kpiCards(report),
    cashBox: cashBox(report),
    cashNote: 'Nei contanti previsti ci sono gli ordini pagati subito alla cassa e i pagamenti in contanti dei conti; carte e altri metodi non entrano nel cassetto.',
    charts: chartsOf(report, noun),
    sections,
    fileName: `report_${String(session.name || `${noun}-${session.id}`).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || `${noun}-${session.id}`}.pdf`,
  };
}
