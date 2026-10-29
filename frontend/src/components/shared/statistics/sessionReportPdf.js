import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildReportModel } from './reportModel';

// Disegna il report di una serata (contenuto deciso da reportModel.js) e lo scarica: intestazione col locale e il periodo,
// una tabella per sezione, a ogni pagina «SmartEats · pagina x di y». Pensato per essere stampato o inviato al commercialista.
const ACCENT = [37, 99, 235];
const GREY = [110, 118, 129];
const RIGHT = new Set(['Valore', 'Importo', 'Incasso', 'Quota', 'Pezzi', 'Omaggi', 'Ordini']);
const MARGIN = 14;

export function downloadSessionReport(report, { noun = 'serata' } = {}) {
  const model = buildReportModel(report, { noun });
  const doc = new jsPDF();
  const width = doc.internal.pageSize.getWidth();
  const height = doc.internal.pageSize.getHeight();

  doc.setTextColor(...GREY).setFontSize(10).text(model.place, MARGIN, 16);
  doc.setTextColor(20).setFont('helvetica', 'bold').setFontSize(17).text(model.title, MARGIN, 25, { maxWidth: width - 2 * MARGIN });
  doc.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...GREY).text(`${model.period}  ·  ${model.generated}`, MARGIN, 32, { maxWidth: width - 2 * MARGIN });

  let y = 40;
  for (const section of model.sections) {
    if (y > height - 50) { doc.addPage(); y = 20; }
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
