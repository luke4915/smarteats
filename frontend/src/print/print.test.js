import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { EposBuilder, printable } from './eposBuilder.js';
import { columnsForPaper, PAPER_OPTIONS } from './paper.js';
import { TEMPLATES, DEFAULT_BRANDING, wrapText, encodeOrderId, filterItems, tableLabel, renderCheckReceipt } from './templates.js';
import { brandingFromSettings, imagesFromSettings } from './branding.js';
import { buildCopyPreviews } from './copyPreviews.js';
import { renderReceipt, renderReceiptParts } from './preview.js';
import { buildPrintJobs, parseAddress } from './print.js';
import { eposDriver, PrintError } from './drivers/epos.js';
import { pickReceiptPrinter, buildReceiptJob } from './receiptJob.js';

const NO_IMAGES = { logo: () => null, numberBanner: () => null };
const ctx = { branding: { ...DEFAULT_BRANDING, name: 'ASSOCIAZIONE PROVA', taxCode: 'C.F. 123' }, images: NO_IMAGES, showLogo: true };

const order = {
  id: 'A12', display_code: 'A12', created_at: '2026-10-03T14:05:09', total: 23.5, is_takeaway: false,
  items: [
    { id: 1, name: 'Panino', quantity: 2, price: 5, note: 'senza cipolla', print_destination: 'kitchen' },
    { id: 2, name: 'Birra', quantity: 3, price: 4.5, print_destination: 'bar' },
  ],
};
const barOnly = { ...order, items: [order.items[1]] };

const render = async (copy, o = order, c = ctx) => {
  const b = new EposBuilder();
  await TEMPLATES[copy](b, o, c);
  return b.buildXml();
};

test('il builder protegge i caratteri speciali nell\'XML', () => {
  const xml = new EposBuilder().text('Acqua <&> 1').buildXml();
  assert.ok(xml.includes('Acqua &lt;&amp;&gt; 1'));
});

test('copia cliente: intestazione, righe, totale e identificativo di ritiro', async () => {
  const xml = await render('Cliente');
  for (const part of ['ASSOCIAZIONE PROVA', 'C.F. 123', 'PANINO', '€ 10,00', '€ 23,50', 'ID RITIRO: ORD000A12140509']) {
    assert.ok(xml.includes(part), `manca: ${part}`);
  }
});

test('senza dati dell\'associazione l\'intestazione non li stampa', async () => {
  const xml = await render('Cliente', order, { ...ctx, branding: DEFAULT_BRANDING });
  assert.ok(!xml.includes('ASSOCIAZIONE PROVA') && !xml.includes('C.F.'));
  assert.ok(xml.includes('DOCUMENTO NON FISCALE'));
});

test('titoli, etichetta del totale e testo legale vengono dalla configurazione del tenant', async () => {
  const branding = {
    ...ctx.branding, title: 'RICEVUTA', itemHeader: 'PRODOTTO', amountHeader: 'EURO', totalLabel: 'TOTALE OFFERTA',
    legalText: 'Prima riga legale\n\n  Seconda riga legale  ',
  };
  const xml = await render('Cliente', order, { ...ctx, branding });
  for (const part of ['RICEVUTA', 'PRODOTTO', 'EURO', 'TOTALE OFFERTA', 'Prima riga legale', 'Seconda riga legale']) {
    assert.ok(xml.includes(part), `manca: ${part}`);
  }
  for (const gone of ['DOCUMENTO NON FISCALE', 'CONTRIBUTO VOLONTARIO', 'D.Lgs.117', 'BENEFICIARIO']) {
    assert.ok(!xml.includes(gone), `non deve esserci: ${gone}`);
  }
});

test('senza testo legale configurato non si stampa nulla di legale', async () => {
  const xml = await render('Cliente');
  assert.ok(xml.includes('TOTALE') && !xml.includes('Raccolta fondi'));
});

test('brandingFromSettings: i valori vuoti o mancanti lasciano il predefinito', () => {
  assert.deepEqual(brandingFromSettings({}), DEFAULT_BRANDING);
  const b = brandingFromSettings({ receipt_org_name: ' Pro Loco ', receipt_title: '', receipt_total_label: '   ', receipt_legal_text: 'Testo' });
  assert.equal(b.name, 'Pro Loco');
  assert.equal(b.title, DEFAULT_BRANDING.title);
  assert.equal(b.totalLabel, DEFAULT_BRANDING.totalLabel);
  assert.equal(b.legalText, 'Testo');
});

test('numeretto senza immagini ripiega sul testo grande', async () => {
  assert.ok((await render('Numeretto')).includes('# A12 #'));
});

test('la copia cucina contiene solo le righe di cucina; ordine di soli prodotti bar: vuota', async () => {
  const xml = await render('Cucina');
  assert.ok(xml.includes('PANINO') && !xml.includes('BIRRA'));
  assert.equal(new EposBuilder().isEmpty, true);
  const b = new EposBuilder();
  await TEMPLATES.Cucina(b, barOnly, ctx);
  assert.equal(b.isEmpty, true);
});

test('wrapText, filterItems ed encodeOrderId', () => {
  assert.deepEqual(wrapText('uno due tre', 7), ['uno due', 'tre']);
  assert.equal(filterItems(order.items, 'bar').length, 1);
  assert.equal(filterItems(order.items, 'all').length, 2);
  assert.equal(encodeOrderId('A1'), 'ORD0000A1');
});

test('indirizzo: porta 443 se omessa', () => {
  assert.deepEqual(parseAddress('192.168.1.50'), { host: '192.168.1.50', port: 443 });
  assert.deepEqual(parseAddress('192.168.1.50:9443'), { host: '192.168.1.50', port: 9443 });
});

test('copie sulla stessa stampante in un unico documento; stampanti diverse in documenti separati', async () => {
  const settings = [
    { copy_type: 'Cliente', printer_address: '10.0.0.5', enabled: true },
    { copy_type: 'Cucina', printer_address: '10.0.0.5:443', enabled: true },
    { copy_type: 'Associazione', printer_address: '10.0.0.6', enabled: true },
  ];
  const jobs = await buildPrintJobs(settings, order, ctx);
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.find(j => j.host === '10.0.0.5').copies, ['Cliente', 'Cucina']);
});

test('copie disabilitate, senza indirizzo o sconosciute non stampano; documenti vuoti si scartano', async () => {
  const settings = [
    { copy_type: 'Cliente', printer_address: '10.0.0.5', enabled: false },
    { copy_type: 'Cucina', printer_address: '', enabled: true },
    { copy_type: 'Inesistente', printer_address: '10.0.0.5', enabled: true },
    { copy_type: 'Cucina', printer_address: '10.0.0.7', enabled: true },
  ];
  assert.equal((await buildPrintJobs(settings.slice(0, 3), order, ctx)).length, 0);
  assert.equal((await buildPrintJobs(settings, barOnly, ctx)).length, 0);
});

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });
const respond = (body) => { globalThis.fetch = async () => ({ text: async () => body }); };

test('driver Epson: successo, rifiuto della stampante, rete assente', async () => {
  const builder = new EposBuilder().text('prova');
  const target = { host: '10.0.0.5' };

  let called;
  globalThis.fetch = async (url, init) => { called = { url, init }; return { text: async () => '<response success="true" code=""/>' }; };
  await eposDriver.send(builder, target);
  assert.equal(called.url, 'https://10.0.0.5:443/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000');
  assert.equal(called.init.method, 'POST');

  respond('<response success="false" code="EPTR_COVER_OPEN"/>');
  await assert.rejects(eposDriver.send(builder, target), (e) => e instanceof PrintError && e.message.includes('EPTR_COVER_OPEN'));

  globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(eposDriver.send(builder, target), (e) => e instanceof PrintError && e.retryable);
});

test('imagesFromSettings: data URL del tenant, null se mancano', () => {
  assert.deepEqual(imagesFromSettings({}), { logoUrl: null, sideImageUrl: null });
  assert.deepEqual(imagesFromSettings({ receipt_logo: 'data:image/png;base64,AAAA', receipt_side_image: '' }), { logoUrl: 'data:image/png;base64,AAAA', sideImageUrl: null });
});

test('renderReceipt disegna testo, allineamento, immagini, QR e taglio', () => {
  const xml = new EposBuilder().align('CT').text('CIAO').align('LT').text('a sinistra')
    .image({ width: 512, height: 90, b64: 'AAAA' }, { align: 'center' }).qrcode('XYZ').cut().buildXml();
  const out = renderReceipt(xml);
  assert.match(out, /\|\s+CIAO\s+\|/);
  assert.match(out, /\|a sinistra\s+\|/);
  assert.match(out, /\[immagine 512x90px\]/);
  assert.match(out, /\[qrcode: XYZ\]/);
  assert.match(out, /taglio/);
});

test('renderReceiptParts separa il testo dalle immagini, in ordine, con i dati a 1 bit', () => {
  const xml = new EposBuilder().text('SOPRA').image({ width: 8, height: 2, b64: 'qrs=' }, { align: 'center' }).text('SOTTO').cut().buildXml();
  const parts = renderReceiptParts(xml);
  assert.equal(parts.length, 3);
  assert.match(parts[0].text, /SOPRA/);
  assert.deepEqual(parts[1], { image: { width: 8, height: 2, b64: 'qrs=' } });
  assert.match(parts[2].text, /SOTTO[\s\S]*✂/);
  assert.ok(!parts[0].text.includes('immagine'));
});

test('anteprima delle copie: usa testi e immagini del tenant e salta le copie vuote', async () => {
  const images = {
    logo: () => ({ width: 512, height: 100, b64: 'AAAA' }),
    numberBanner: () => ({ width: 512, height: 150, b64: 'AAAA' }),
  };
  const branding = { ...DEFAULT_BRANDING, name: 'PRO LOCO PROVA', totalLabel: 'TOTALE OFFERTA' };
  const previews = await buildCopyPreviews(branding, images);
  assert.deepEqual(previews.map(p => p.name), ['Numeretto', 'Cliente', 'Associazione', 'Cucina', 'Ritiro Gastronomia', 'Ritiro Bar']);
  const cliente = previews.find(p => p.name === 'Cliente').text;
  assert.ok(cliente.includes('PRO LOCO PROVA') && cliente.includes('TOTALE OFFERTA') && cliente.includes('[immagine 512x100px]'));
  assert.ok(previews.find(p => p.name === 'Numeretto').text.includes('[immagine 512x150px]'));
});

test('la comanda di un tavolo mostra tavolo e coperti nelle copie di cucina e bar; un ordine al banco no', async () => {
  const atTable = { ...order, table_name: 'T5', covers: 4 };
  for (const copy of ['Cucina', 'Ritiro Gastronomia', 'Ritiro Bar']) {
    const xml = await render(copy, atTable);
    assert.ok(xml.includes('TAVOLO T5 · 4 COPERTI'), `${copy}: manca il tavolo`);
    assert.ok(!(await render(copy, order)).includes('TAVOLO'), `${copy}: ordine al banco senza tavolo`);
  }
});

test('etichetta del tavolo: singolare, senza coperti, nessun tavolo', () => {
  assert.equal(tableLabel({ table_name: 'Terrazza 2', covers: 1 }), 'TAVOLO TERRAZZA 2 · 1 COPERTO');
  assert.equal(tableLabel({ table_name: 'T1', covers: 0 }), 'TAVOLO T1');
  assert.equal(tableLabel({ table_name: null, covers: null }), null);
});

test('ricevuta del conto: righe, totale, pagamenti e residuo; non fiscale', async () => {
  const receipt = {
    scope: 'check', total: 14.5, paid: 8, due: 6.5,
    check: { number: 3, table_name: 'T5', covers: 2 },
    lines: [{ name: 'Panino', quantity: 2, amount: 10 }, { name: 'Birra', quantity: 1, amount: 4.5 }],
    payments: [{ method: 'cash', amount: 5 }, { method: 'card', amount: 3 }],
  };
  const b = new EposBuilder();
  await renderCheckReceipt(b, receipt, ctx);
  const xml = b.buildXml();
  for (const part of ['CONTO', 'Tavolo T5 - 2 coperti - Conto n. 3', 'PANINO', '€ 14,50', 'Contanti', 'Carta', '€ 6,50', 'DOCUMENTO NON FISCALE'])
    assert.ok(xml.includes(part), `manca: ${part}`);
});

test('ricevuta di un pagamento per voce: solo la quota pagata e il residuo del conto', async () => {
  const receipt = {
    scope: 'payment', total: 14.5, paid: 5, due: 9.5,
    check: { number: 1, table_name: 'T1', covers: 1 },
    lines: [{ name: 'Panino', quantity: 1, amount: 5 }],
    payments: [{ method: 'cash', amount: 5 }],
  };
  const b = new EposBuilder();
  await renderCheckReceipt(b, receipt, ctx);
  const xml = b.buildXml();
  for (const part of ['RICEVUTA DI PAGAMENTO', '1 coperto', 'PAGATO Contanti', 'Residuo del conto: € 9,50'])
    assert.ok(xml.includes(part), `manca: ${part}`);
  assert.ok(!xml.includes('BIRRA'));
});

test('la ricevuta va alla stampante della copia Cliente, altrimenti alla prima attiva; senza stampanti nulla', async () => {
  const settings = [
    { copy_type: 'Cucina', printer_address: '10.0.0.2', enabled: true },
    { copy_type: 'Cliente', printer_address: '10.0.0.1:9443', enabled: true },
  ];
  assert.equal(pickReceiptPrinter(settings).printer_address, '10.0.0.1:9443');
  assert.equal(pickReceiptPrinter([settings[0]]).printer_address, '10.0.0.2');
  assert.equal(pickReceiptPrinter([{ ...settings[1], enabled: false }, { copy_type: 'Bar', printer_address: '', enabled: true }]), null);
  // la stampante «Conto» del ristorante ha la precedenza, anche sulla copia «Cliente»
  assert.equal(pickReceiptPrinter([{ copy_type: 'Cliente', printer_address: '10.0.0.1', enabled: true }, { copy_type: 'Conto', printer_address: '10.0.0.9', enabled: true }]).printer_address, '10.0.0.9');

  const receipt = { scope: 'check', total: 5, paid: 0, due: 5, check: { id: 1, number: 2, table_name: 'T1', covers: 1 },
    lines: [{ name: 'Panino', quantity: 1, amount: 5 }], payments: [] };
  const job = await buildReceiptJob({ settings, branding: DEFAULT_BRANDING }, receipt, NO_IMAGES);
  assert.deepEqual([job.host, job.port], ['10.0.0.1', 9443]);
  assert.ok(job.builder.buildXml().includes('PANINO'));
  assert.equal(await buildReceiptJob({ settings: [], branding: DEFAULT_BRANDING }, receipt, NO_IMAGES), null);
});

test('il testo è sempre stampabile: virgolette semplici, niente caratteri che rompono l\'XML o emoji', () => {
  assert.equal(printable('Panino “della casa” – l’ultimo…'), 'Panino "della casa" - l\'ultimo...');
  assert.equal(printable('con\u0008 nota\u0000 🍕'), 'con nota ');
  const xml = new EposBuilder().text('a\u0007b <c> & d').buildXml();
  assert.match(xml, /ab &lt;c&gt; &amp; d/);
});

test('nomi lunghi: nei ritiri grandi vanno a capo senza perdere parole; opzioni e note vanno a capo', async () => {
  const { printer, xml } = await (async () => { const p = new EposBuilder(); return { printer: p, xml: () => p.buildXml() }; })();
  const order = { id: 7, display_code: 'A7', created_at: '2026-11-02T10:00:00Z', total: 12, items: [{ name: 'Panino con porchetta di Ariccia e cipolla caramellata', quantity: 2, price: 6, line_total: 12, modifiers: [{ name: 'senza maionese' }, { name: 'salsa piccante extra forte' }, { name: 'doppia porchetta' }], note: 'servire separato dal resto per favore e grazie mille' }] };
  await TEMPLATES['Ritiro Gastronomia'](printer, order, { branding: DEFAULT_BRANDING, images: { logo: async () => null, numberBanner: async () => null }, showLogo: false });
  const out = xml();
  for (const word of ['PORCHETTA', 'ARICCIA', 'CARAMELLATA']) assert.ok(out.includes(word), `${word} non deve sparire dal ritiro`);
  const rows = [...out.matchAll(/<text [^>]*>([^<]*?)&#10;<\/text>/g)].map(m => m[1].replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'));
  assert.ok(rows.every(r => r.length <= 42), 'nessuna riga oltre la larghezza dello scontrino (nei caratteri grandi, metà)');
});

// Nessuna riga può uscire più larga della carta: ogni lettera conta quanto il suo ingrandimento (size 2 = due colonne).
const textRows = (xml) => [...xml.matchAll(/<text ([^>]*)>([^<]*?)&#10;<\/text>/g)].map(([, attrs, body]) => ({
  width: Number(attrs.match(/width="(\d)"/)[1]), text: body.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&'),
}));
const WIDE_ORDER = {
  id: 7, display_code: 'A137', created_at: '2026-11-02T10:00:00Z', total: 48.5, is_takeaway: true, table_name: 'Terrazza 12', covers: 4, course_name: 'Secondo e contorno',
  items: [
    { name: 'Panino con porchetta di Ariccia e cipolla caramellata', quantity: 12, price: 6, line_total: 72, modifiers: [{ name: 'senza maionese' }, { name: 'salsa piccante extra forte' }], note: 'servire separato dal resto per favore', print_destination: 'kitchen' },
    { name: 'Birra', quantity: 1, price: 4.5, line_total: 4.5, print_destination: 'bar' },
  ],
};

test('ogni copia sta nella carta, da 58 mm (32 lettere) e da 80 mm (42)', async () => {
  const branding = { ...DEFAULT_BRANDING, name: 'Associazione Culturale Amici della Sagra del Borgo', taxCode: 'C.F. 01234567890 - P.IVA 01234567890', legalText: 'Raccolta fondi occasionale ai sensi dell\'art. 7 D.Lgs. 117/17' };
  const images = { logo: async () => null, numberBanner: async () => null };
  for (const { mm } of PAPER_OPTIONS) {
    const columns = columnsForPaper(mm);
    for (const [name, template] of Object.entries(TEMPLATES)) {
      const builder = new EposBuilder();
      await template(builder, WIDE_ORDER, { branding, images, showLogo: true, columns });
      for (const row of textRows(builder.buildXml())) assert.ok(row.text.length * row.width <= columns, `${name} a ${mm} mm: «${row.text}» è largo ${row.text.length * row.width} su ${columns}`);
    }
    const receipt = { check: { table_name: 'Terrazza 12', covers: 4, number: 31 }, lines: [{ name: 'Tagliata di manzo con rucola e grana', quantity: 2, amount: 38 }], payments: [{ method: 'card', amount: 10 }], total: 38, due: 28, scope: 'check' };
    const builder = new EposBuilder();
    await renderCheckReceipt(builder, receipt, { branding, images, showLogo: true, columns });
    for (const row of textRows(builder.buildXml())) assert.ok(row.text.length * row.width <= columns, `ricevuta a ${mm} mm: «${row.text}» è larga ${row.text.length * row.width} su ${columns}`);
  }
});

test('la carta: 80 mm è il valore di prima; una misura sconosciuta torna a 80 mm', () => {
  assert.equal(columnsForPaper(80), 42);
  assert.equal(columnsForPaper(58), 32);
  assert.equal(columnsForPaper(undefined), 42);
  assert.equal(columnsForPaper(72), 42);
});

test('più copie sulla stessa stampante: una sola carta, la più stretta', async () => {
  const settings = [
    { copy_type: 'Cliente', printer_address: '10.0.0.5', enabled: true, paper_mm: 80 },
    { copy_type: 'Cucina', printer_address: '10.0.0.5', enabled: true, paper_mm: 58 },
  ];
  const [job] = await buildPrintJobs(settings, WIDE_ORDER, { branding: DEFAULT_BRANDING, images: { logo: async () => null, numberBanner: async () => null }, showLogo: false });
  for (const row of textRows(job.builder.buildXml())) assert.ok(row.text.length * row.width <= 32, row.text);
});

// ── ESC/POS: gli stessi template, i byte per le stampanti che non parlano ePOS ──
import { EscPosBuilder, encodeText } from './escposBuilder.js';

test('ESC/POS: testo con € e accenti in CP858, riga a capo, allineamento e grassetto', () => {
  assert.deepEqual(encodeText('€ 12,50'), [0xD5, 0x20, 0x31, 0x32, 0x2C, 0x35, 0x30]);
  assert.deepEqual(encodeText('è così'), [0x8A, 0x20, 0x63, 0x6F, 0x73, 0x8D]);
  assert.deepEqual(encodeText('日本'), [0x3F, 0x3F], 'quello che la stampante non ha diventa «?»');
  const bytes = [...new EscPosBuilder().align('CT').style('B').text('Ciao').buildBytes()];
  assert.deepEqual(bytes.slice(0, 5), [0x1B, 0x40, 0x1B, 0x74, 19], 'azzera e sceglie CP858');
  assert.deepEqual(bytes.slice(5), [0x1B, 0x45, 1, 0x1B, 0x2D, 0, 0x1B, 0x61, 1, 0x43, 0x69, 0x61, 0x6F, 0x0A]);
});

test('ESC/POS: ingrandimento, banda inversa, avanzamento, taglio e QR', () => {
  const b = new EscPosBuilder();
  b.size(2, 3).reverse(true).feed(2).cut().qrcode('ABC');
  const bytes = [...b.buildBytes()].slice(5);
  assert.deepEqual(bytes.slice(0, 3), [0x1D, 0x21, 0x12], 'larghezza 2, altezza 3');
  assert.deepEqual(bytes.slice(3, 6), [0x1D, 0x42, 1]);
  assert.deepEqual(bytes.slice(6, 9), [0x1B, 0x64, 2]);
  assert.deepEqual(bytes.slice(9, 13), [0x1D, 0x56, 66, 0]);
  const qr = bytes.slice(13);
  assert.ok(qr.join(',').includes('29,40,107,6,0,49,80,48,65,66,67'), 'dati del QR: lunghezza 3 + 3');
  assert.deepEqual(qr.slice(-8), [0x1D, 0x28, 0x6B, 3, 0, 0x31, 0x51, 0x30], 'finisce con la stampa del QR');
});

test('ESC/POS: un\'immagine a 1 bit diventa un raster con le sue dimensioni', () => {
  const b = new EscPosBuilder().image({ width: 10, height: 2, b64: btoa(String.fromCharCode(0xFF, 0xC0, 0x0F, 0x00)) }, { align: 'center' });
  assert.deepEqual([...b.buildBytes()].slice(5), [0x1B, 0x61, 1, 0x1D, 0x76, 0x30, 0, 2, 0, 2, 0, 0xFF, 0xC0, 0x0F, 0x00]);
});

test('ESC/POS: i template sono gli stessi: una copia cucina esce con testo e taglio, a 58 e 80 mm', async () => {
  const images = { logo: async () => null, numberBanner: async () => null };
  for (const columns of [32, 42]) {
    const builder = new EscPosBuilder();
    await TEMPLATES.Cucina(builder, WIDE_ORDER, { branding: DEFAULT_BRANDING, images, showLogo: false, columns });
    const bytes = builder.buildBytes();
    assert.equal(builder.isEmpty, false);
    assert.ok(Buffer.from(bytes).includes(Buffer.from('COPIA CUCINA')));
    assert.deepEqual([...bytes.slice(-4)], [0x1D, 0x56, 66, 0], 'finisce con il taglio');
  }
  const bar = new EscPosBuilder();
  await TEMPLATES['Ritiro Bar'](bar, { ...WIDE_ORDER, items: [{ name: 'Panino', quantity: 1, price: 5, print_destination: 'kitchen' }] }, { branding: DEFAULT_BRANDING, images, showLogo: false });
  assert.equal(bar.isEmpty, true, 'una copia senza righe non stampa niente');
});
