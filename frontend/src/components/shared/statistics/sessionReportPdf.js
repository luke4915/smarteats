import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildReportModel } from './reportModel';
import { hBars, columns, split, kpiCards, cashBox } from './pdfCharts';

// Disegna il report di una serata (contenuto deciso da reportModel.js) e lo scarica: intestazione col locale e il periodo, le cifre
// grandi, la cassa, i grafici (pagamenti, categorie, andamento per ora) e le tabelle precise; a ogni pagina «SmartEats · pagina x di y».
// Pensato per essere letto in un colpo d'occhio, stampato o inviato al commercialista.
const ACCENT = [37, 99, 235];
const GREY = [110, 118, 129];
const RIGHT = new Set(['Valore', 'Importo', 'Incasso', 'Quota', 'Pezzi', 'Omaggi', 'Ordini']);
const MARGIN = 14;
const DRAW = { split, bars: hBars, columns };
const NEEDS = { split: 40, bars: 90, columns: 70 };       // spazio minimo (mm) per non spezzare un grafico a cavallo di due pagine

export function downloadSessionReport(report, { noun = 'serata' } = {}) {
  const model = buildReportModel(report, { noun });
  const doc = new jsPDF();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();
  const room = (y, need) => (y + need > height - 18 ? (doc.addPage(), 20) : y);

  doc.setTextColor(...GREY).setFontSize(10).text(model.place, MARGIN, 16);
  doc.setTextColor(20).setFont('helvetica', 'bold').setFontSize(17).text(model.title, MARGIN, 25, { maxWidth: width - 2 * MARGIN });
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GREY).text(`${model.period}  ·  ${model.generated}`, MARGIN, 32, { maxWidth: width - 2 * MARGIN });

  let y = kpiCards(doc, model.kpis, 40);
  y = cashBox(doc, model.cashBox, model.cashNote, room(y, 40));
  for (const chart of model.charts) {
    y = room(y, NEEDS[chart.type]);
    y = DRAW[chart.type](doc, chart.title, chart.rows, y);
  }

  for (const section of model.sections) {
    y = room(y, Math.min(14 + section.body.length * 7, 90));       // una tabella corta non si spezza su due pagine
    doc.setTextColor(20).setFont('helvetica', 'bold').setFontSize(12).text(section.title, MARGIN, y);
    autoTable(doc, {
      startY: y + 3,
      head: [section.head],
      body: section.body,
      theme: 'striped',
      styles: { fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: ACCENT },
      columnStyles: Object.fromEntries(section.head.map((h, i) => [i, { halign: RIGHT.has(h) ? 'right' : 'left' }])),
      margin: { left: MARGIN, right: MARGIN, bottom: 18 },
      didParseCell: (cell) => { if (cell.section === 'head' && RIGHT.has(section.head[cell.column.index])) cell.cell.styles.halign = 'right'; },
    });
    y = doc.lastAutoTable.finalY + 4;
    if (section.note) {
      doc.setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY).text(section.note, MARGIN, y, { maxWidth: width - 2 * MARGIN });
      y += 5;
    }
    y += 6;
  }

  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page).setFont('helvetica', 'normal').setFontSize(8).setTextColor(...GREY)
      .text(`SmartEats  ·  pagina ${page} di ${pages}`, width / 2, height - 8, { align: 'center' });
  }
  doc.save(model.fileName);
}
