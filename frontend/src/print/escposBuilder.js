// Costruisce un documento ESC/POS (i byte che le stampanti termiche capiscono davvero: Epson, Star in modalità ESC/POS, Bixolon,
// Citizen e la gran parte delle altre). Ha gli stessi metodi di EposBuilder (text, align, style, size, feed, cut, qrcode, image),
// quindi i template sono gli stessi: cambia solo cosa esce. Nessuna dipendenza dal browser: si testa in Node.
//
// Il testo parte in CP858 (l'alfabeto europeo con l'€ e le lettere accentate): è quello che le stampanti vendute in Europa hanno di
// serie. Una lettera che la stampante non ha esce come «?».
import { printable } from './eposBuilder.js';

const ESC = 0x1B, GS = 0x1D, LF = 0x0A;
const CODE_PAGE_CP858 = 19;   // numero della tabella CP858 nel comando ESC t (Epson e compatibili)

// Le lettere 0x80-0xFF di CP858, in ordine: la posizione nel testo è il byte.
const CP858_HIGH = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈ€ÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´­±‗¾¶§÷¸°¨·¹³²■ ';
const CP858 = new Map([...CP858_HIGH].map((ch, i) => [ch, 0x80 + i]));

const ALIGN = { left: 0, center: 1, right: 2 };
const QR_LEVEL = { level_l: 48, level_m: 49, level_q: 50, level_h: 51 };
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// Il testo come byte CP858; quello che non c'è nella tabella (o oltre il Latin-1 esteso) diventa «?»
export function encodeText(str) {
  const out = [];
  for (const ch of printable(str)) {
    const code = ch.codePointAt(0);
    if (code >= 0x20 && code < 0x7F) out.push(code);
    else out.push(CP858.get(ch) ?? 0x3F);
  }
  return out;
}

export class EscPosBuilder {
  constructor() {
    this.bytes = [ESC, 0x40, ESC, 0x74, CODE_PAGE_CP858];   // azzera la stampante e sceglie l'alfabeto
    this.empty = true;
    this._align = 'left';
    this._w = 1;
    this._h = 1;
  }

  get isEmpty() { return this.empty; }

  _push(...bytes) { this.bytes.push(...bytes); this.empty = false; return this; }

  align(pos) {
    const p = String(pos ?? '').toUpperCase().trim();
    this._align = p === 'CT' || p === 'CENTER' ? 'center' : p === 'RT' || p === 'RIGHT' ? 'right' : 'left';
    return this;
  }

  // Grassetto e sottolineato: «B», «U», «BU»; qualsiasi altra cosa li toglie
  style(s) {
    const bold = s === 'B' || s === 'BU', underline = s === 'U' || s === 'BU';
    this.bytes.push(ESC, 0x45, bold ? 1 : 0, ESC, 0x2D, underline ? 1 : 0);
    return this;
  }

  reverse(on = true) { this.bytes.push(GS, 0x42, on ? 1 : 0); return this; }

  font(name = 'font_a') { this.bytes.push(ESC, 0x4D, name === 'font_b' ? 1 : 0); return this; }

  size(w, h) {
    this._w = clamp(w, 1, 8); this._h = clamp(h, 1, 8);
    this.bytes.push(GS, 0x21, ((this._w - 1) << 4) | (this._h - 1));
    return this;
  }

  text(str) {
    return this._push(ESC, 0x61, ALIGN[this._align], ...encodeText(str), LF);
  }

  // raster: { width, height, b64 } a 1 bit, un bit acceso = nero, righe di ceil(width / 8) byte (vedi raster.js)
  image(raster, { align = null } = {}) {
    if (!raster) return this;
    const data = Uint8Array.from(atob(raster.b64), c => c.charCodeAt(0));
    const perRow = Math.ceil(raster.width / 8);
    return this._push(ESC, 0x61, ALIGN[align ? String(align).toLowerCase() : this._align] ?? 0,
      GS, 0x76, 0x30, 0, perRow & 0xFF, perRow >> 8, raster.height & 0xFF, raster.height >> 8, ...data);
  }

  feed(n = 1) { return this._push(ESC, 0x64, clamp(n, 0, 255)); }

  // Avanza fino al taglio e taglia (parziale, come fa «cut feed» di ePOS)
  cut() { return this._push(GS, 0x56, 66, 0); }

  qrcode(data, { model = 'model2', level = 'level_l', width = 3 } = {}) {
    const payload = [...new TextEncoder().encode(String(data))];
    const store = payload.length + 3;
    return this._push(
      ESC, 0x61, ALIGN[this._align],
      GS, 0x28, 0x6B, 4, 0, 0x31, 0x41, model === 'model1' ? 0x31 : 0x32, 0,   // modello
      GS, 0x28, 0x6B, 3, 0, 0x31, 0x43, clamp(width, 1, 8),                   // grandezza dei moduli
      GS, 0x28, 0x6B, 3, 0, 0x31, 0x45, QR_LEVEL[level] ?? 48,                // correzione degli errori
      GS, 0x28, 0x6B, store & 0xFF, store >> 8, 0x31, 0x50, 0x30, ...payload,    // dati
      GS, 0x28, 0x6B, 3, 0, 0x31, 0x51, 0x30,                                 // stampa
    );
  }

  // I byte da mandare alla stampante
  buildBytes() { return Uint8Array.from(this.bytes); }
}
