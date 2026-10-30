// I grafici del report PDF, disegnati con le primitive di jsPDF (niente librerie in più): barre orizzontali, colonne e una barra
// divisa in parti. Un solo colore d'accento per i valori (le parti di una divisione usano tre tinte della stessa famiglia), con il valore
// scritto accanto, così si legge anche in bianco e nero. Ogni funzione parte da `y` e ritorna la `y` libera sotto.
const ACCENT = [37, 99, 235];
const TINTS = [[37, 99, 235], [96, 140, 240], [160, 190, 245], [200, 210, 225]];
const GREY = [110, 118, 129];
const TRACK = [236, 239, 244];
const X = 14;

// Titolo di un grafico.
function title(doc, text, y) {
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20).text(text, X, y);
  return y + 5;
}

// Barre orizzontali: una riga per voce, la barra è proporzionale al valore massimo.
export function hBars(doc, text, rows, y, width = 182) {
  let at = title(doc, text, y);
  const labelW = 42, valueW = 34, trackW = width - labelW - valueW;
  const max = Math.max(...rows.map(r => r.value), 1);
  for (const r of rows) {
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40).text(String(r.label).slice(0, 24), X, at + 3.6);
    doc.setFillColor(...TRACK).roundedRect(X + labelW, at, trackW, 4.6, 1.2, 1.2, 'F');
    doc.setFillColor(...ACCENT).roundedRect(X + labelW, at, Math.max(1.2, (r.value / max) * trackW), 4.6, 1.2, 1.2, 'F');
    doc.setTextColor(...GREY).text(r.text, X + labelW + trackW + 3, at + 3.6);
    at += 7;
  }
  return at + 8;
}

// Colonne: una per voce, con l'etichetta sotto (l'ora) e il valore scritto sopra la più alta.
export function columns(doc, text, rows, y, width = 182, height = 38) {
  const top = title(doc, text, y) + 6;
  const max = Math.max(...rows.map(r => r.value), 1);
  const gap = 2, bar = Math.min(14, (width - gap * (rows.length - 1)) / rows.length);
  const total = rows.length * bar + (rows.length - 1) * gap;
  const left = X + (width - total) / 2;
  const peak = rows.reduce((best, r, i) => (r.value > rows[best].value ? i : best), 0);
  rows.forEach((r, i) => {
    const h = Math.max(0.8, (r.value / max) * height);
    const x = left + i * (bar + gap);
    doc.setFillColor(...(i === peak ? ACCENT : TINTS[1])).roundedRect(x, top + height - h, bar, h, 1, 1, 'F');
    doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY).text(r.label, x + bar / 2, top + height + 4.5, { align: 'center' });
    if (i === peak) doc.setFont('helvetica', 'bold').setTextColor(20).text(String(Math.round(r.value)), x + bar / 2, top + height - h - 1.5, { align: 'center' });
  });
  doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY).text(`Ora di apertura dei conti o di battitura degli ordini; in blu scuro l'ora più forte (${rows[peak].text}).`, X, top + height + 10);
  return top + height + 20;
}

// Una barra divisa in parti (per i metodi di pagamento), con la legenda sotto.
export function split(doc, text, rows, y, width = 182) {
  let at = title(doc, text, y) + 1;
  const total = rows.reduce((n, r) => n + r.value, 0) || 1;
  let x = X;
  rows.forEach((r, i) => {
    const w = (r.value / total) * width;
    doc.setFillColor(...TINTS[Math.min(i, TINTS.length - 1)]).rect(x, at, Math.max(w, 0.6), 6, 'F');
    x += w;
  });
  at += 12;
  rows.forEach((r, i) => {
    doc.setFillColor(...TINTS[Math.min(i, TINTS.length - 1)]).rect(X, at - 3, 3.2, 3.2, 'F');
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40).text(`${r.label}  ${r.text}`, X + 6, at);
    at += 5.4;
  });
  return at + 8;
}

// Quattro cifre grandi in riquadri (incasso, ordini…).
export function kpiCards(doc, cards, y, width = 182) {
  const gap = 4, w = (width - gap * (cards.length - 1)) / cards.length;
  cards.forEach((c, i) => {
    const x = X + i * (w + gap);
    doc.setFillColor(244, 246, 250).roundedRect(x, y, w, 20, 2.5, 2.5, 'F');
    doc.setFont('helvetica', 'normal').setFontSize(8.5).setTextColor(...GREY).text(c.label, x + 4, y + 6.5);
    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(20).text(c.value, x + 4, y + 15, { maxWidth: w - 6 });
  });
  return y + 26;
}

// La scatola della cassa: previsto, contato, e la differenza con un tono (verde, rosso, neutro).
export function cashBox(doc, box, note, y, width = 182) {
  const tone = { good: [220, 244, 230], bad: [252, 226, 226], neutral: [244, 246, 250] }[box.tone];
  const ink = { good: [21, 128, 61], bad: [185, 28, 28], neutral: GREY }[box.tone];
  doc.setFillColor(...tone).roundedRect(X, y, width, 24, 2.5, 2.5, 'F');
  doc.setFont('helvetica', 'bold').setFontSize(11).setTextColor(20).text(box.title, X + 4, y + 7);
  doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(40)
    .text(`Previsti ${box.expected}   ·   Contati ${box.declared}`, X + 4, y + 13.5)
    .setFont('helvetica', 'bold').setTextColor(...ink).text(box.verdict, X + 4, y + 19.5);
  doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...GREY).text(note, X, y + 29, { maxWidth: width });
  return y + 37;
}
