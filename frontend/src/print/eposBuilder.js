// Costruisce il documento ePOS-Print XML (Epson). I template parlano solo con questa
// interfaccia (text, align, style, size, feed, cut, qrcode, image): per un'altra marca
// basta un builder con gli stessi metodi. Nessuna dipendenza dal browser: si testa in Node.

// Virgolette e trattini «tipografici» (da copia e incolla) che le stampanti non hanno nella loro tabella di caratteri: diventano quelli semplici.
const LOOKALIKES = { '’': "'", '‘': "'", '“': '"', '”': '"', '«': '"', '»': '"', '–': '-', '—': '-', '…': '...', '\u00A0': ' ' };

// Un carattere di controllo (o uno non valido in XML) in un nome o in una nota renderebbe il documento illeggibile per la stampante,
// che lo rifiuterebbe per sempre: la coda lo riproverebbe all'infinito. Qui si tolgono prima.
export function printable(s) {
  return String(s)
    .replace(/[‘’“”«»–—…\u00A0]/g, (c) => LOOKALIKES[c])
    // eslint-disable-next-line no-control-regex -- sono proprio i caratteri da togliere
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/[\uD800-\uDFFF]/g, '');   // emoji e simili: la stampante stamperebbe «?»
}

function escapeXml(s) {
  return printable(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mapAlign(pos) {
  if (!pos) return 'left';
  const p = String(pos).toUpperCase().trim();
  if (p === 'CT' || p === 'CENTER') return 'center';
  if (p === 'RT' || p === 'RIGHT') return 'right';
  return 'left';
}

const clampSize = (n) => Math.max(1, Math.min(8, n));

export class EposBuilder {
  constructor() {
    this.elements = [];
    this._align = 'left';
    this._bold = false;
    this._underline = false;
    this._reverse = false;
    this._font = 'font_a';
    this._w = 1;
    this._h = 1;
  }

  get isEmpty() { return this.elements.length === 0; }

  align(pos) { this._align = mapAlign(pos); return this; }

  style(s) {
    if (s === 'B') this._bold = true;
    else if (s === 'U') this._underline = true;
    else if (s === 'BU') { this._bold = true; this._underline = true; }
    else { this._bold = false; this._underline = false; }
    return this;
  }

  // Banda nera con testo bianco
  reverse(on = true) { this._reverse = !!on; return this; }

  // font_a (leggibile) o font_b (condensato)
  font(name = 'font_a') { this._font = name; return this; }

  size(w, h) { this._w = clampSize(w); this._h = clampSize(h); return this; }

  text(str) {
    const attrs = [
      `align="${this._align}"`,
      `width="${this._w}"`,
      `height="${this._h}"`,
      `em="${this._bold}"`,
      `ul="${this._underline}"`,
      `reverse="${this._reverse}"`,
      `font="${this._font}"`,
    ];
    this.elements.push(`<text ${attrs.join(' ')}>${escapeXml(str)}&#10;</text>`);
    return this;
  }

  // raster: { width, height, b64 } già in bianco e nero a 1 bit (vedi raster.js)
  image(raster, { align = null } = {}) {
    if (!raster) return this;
    this.elements.push(`<text align="${mapAlign(align || this._align)}"/>`);
    this.elements.push(`<image width="${raster.width}" height="${raster.height}">${raster.b64}</image>`);
    return this;
  }

  feed(n = 1) { this.elements.push(`<feed line="${n}"/>`); return this; }

  cut() { this.elements.push('<cut type="feed"/>'); return this; }

  qrcode(data, { model = 'model2', level = 'level_l', width = 3 } = {}) {
    const attrs = [`type="qrcode"`, `model="${model}"`, `level="${level}"`, `width="${Math.max(1, Math.min(8, width))}"`];
    this.elements.push(`<barcode ${attrs.join(' ')}>${escapeXml(data)}</barcode>`);
    return this;
  }

  buildXml() {
    return (
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>' +
      `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">${this.elements.join('')}</epos-print>` +
      '</s:Body></s:Envelope>'
    );
  }
}
