// Anteprima in testo dell'XML ePOS: mostra una copia come uscirebbe dalla stampante, senza immagini
// reali (al loro posto un segnaposto con le dimensioni). Serve all'anteprima nel pannello master e
// alla stampante simulata (scripts/mock-epos.js). Nessuna dipendenza dal browser.
const DEFAULT_COLUMNS = 42; // lettere per riga, come la TM-T20 a 80 mm con font A

const decode = (s) => s.replace(/&#10;/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const attr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1];

// Dispone l'XML ePOS in elementi: righe di testo già allineate (senza cornice), immagini con i loro dati
// a 1 bit, QR e taglio. Le righe hanno larghezza variabile: la cornice la aggiunge chi le mostra.
function layoutReceipt(xml, columns) {
  const items = [];
  const row = (text) => items.push({ row: text.padEnd(columns).slice(0, columns) });

  for (const [, name, attrs, body = ''] of xml.matchAll(/<(text|feed|cut|image|barcode)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g)) {
    if (name === 'text') {
      const content = decode(body);
      if (!content) continue; // <text align="center"/> da solo: cambia solo l'allineamento
      const width = Number(attr(attrs, 'width') || 1);
      const shown = attr(attrs, 'reverse') === 'true' ? `▌${content}▐` : content;
      const spaced = width > 1 ? [...shown].join(' '.repeat(width - 1)) : shown;
      const align = attr(attrs, 'align');
      const pad = align === 'center' ? Math.floor((columns - spaced.length) / 2) : align === 'right' ? columns - spaced.length : 0;
      row(' '.repeat(Math.max(0, pad)) + spaced);
      if (Number(attr(attrs, 'height') || 1) > 1) row('');
    } else if (name === 'feed') {
      for (let i = 0; i < Number(attr(attrs, 'line') || 1); i++) row('');
    } else if (name === 'image') {
      items.push({ image: { width: Number(attr(attrs, 'width')), height: Number(attr(attrs, 'height')), b64: body.trim() } });
    } else if (name === 'barcode') {
      row(`   [${attr(attrs, 'type')}: ${decode(body)}]`);
    } else if (name === 'cut') {
      items.push({ cut: true });
    }
  }
  return items;
}

// Disegna l'XML ePOS come uno scontrino di testo: allineamento, ingrandimenti in larghezza,
// banda inversa, immagini e QR (questi ultimi indicati con un segnaposto).
export function renderReceipt(xml, columns = DEFAULT_COLUMNS) {
  const edge = `+${'-'.repeat(columns)}+`;
  const lines = layoutReceipt(xml, columns).map((item) => {
    if (item.row !== undefined) return `|${item.row}|`;
    if (item.image) return `|${`   [immagine ${item.image.width}x${item.image.height}px]`.padEnd(columns).slice(0, columns)}|`;
    return `${'- '.repeat(columns / 2 + 1)}✂ taglio`;
  });
  return [edge, ...lines, edge].join('\n');
}

// Come renderReceipt, ma con le immagini a parte: una lista di { text } e { image: { width, height, b64 } }
// in ordine, per mostrare lo scontrino con le immagini vere. Il taglio chiude il testo con la riga tratteggiata.
export function renderReceiptParts(xml, columns = DEFAULT_COLUMNS) {
  const parts = [];
  let rows = [];
  const flush = () => { if (rows.length) parts.push({ text: rows.join('\n') }); rows = []; };
  for (const item of layoutReceipt(xml, columns)) {
    if (item.row !== undefined) rows.push(item.row.trimEnd());
    else if (item.image) { flush(); parts.push({ image: item.image }); }
    else rows.push('- '.repeat(columns / 2) + '✂');
  }
  flush();
  return parts;
}
