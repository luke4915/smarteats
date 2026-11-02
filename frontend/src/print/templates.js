// Template delle copie (numeretto, cliente, associazione, cucina, ritiro gastronomia/bar).
// Scrivono su un builder (eposBuilder.js) e non conoscono rete né browser.
//
// ctx = {
//   branding: contenuto degli scontrini del tenant (vedi DEFAULT_BRANDING); nome e codice fiscale sono facoltativi
//   images:   { logo(), numberBanner(code, variant) }   raster o null: senza immagini si usa il testo
//   showLogo: boolean
//   columns:  quante lettere stanno in una riga (32 per la carta da 58 mm, 42 per quella da 80 mm); senza, 42
// }
// order = { id, display_code, created_at, total, is_takeaway, items[] }; id è il codice ordine.

import { DEFAULT_COLUMNS, columnsOf, rule, bigLines, wrapText, rowLR, rowThreeColumns, money } from './layout.js';
export { DEFAULT_COLUMNS, wrapText, money };

// Testi dello scontrino configurabili per tenant (impostazioni receipt_*). Quelli mancanti
// usano questi valori neutri; nome, codice fiscale e testo legale, se vuoti, non si stampano.
export const DEFAULT_BRANDING = {
  name: '',
  taxCode: '',
  title: 'DOCUMENTO NON FISCALE',
  itemHeader: 'ARTICOLO',
  amountHeader: 'IMPORTO',
  totalLabel: 'TOTALE',
  legalText: '',
};

// Identificativo di ritiro: ORD + codice ordine + ora (HHMMSS).
export function encodeOrderId(orderId, timestamp) {
  let code = orderId.toString(36).toUpperCase().padStart(6, '0');
  if (timestamp) {
    const d = new Date(timestamp);
    code += String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0') + String(d.getSeconds()).padStart(2, '0');
  }
  return `ORD${code}`;
}

export function filterItems(items, destination) {
  if (destination === 'all') return items;
  return items.filter((item) => (item.print_destination || 'both') === 'both' || item.print_destination === destination);
}

function textBigNumber(printer, code, columns) {
  const text = `# ${code} #`;
  const size = Math.max(1, Math.min(4, Math.floor(columns / text.length)));   // il più grande che sta nella riga
  printer.align('CT').size(size, size).style('B').text(text).size(1, 1).style('NORMAL');
}

async function renderNumberSlip(printer, order, ctx) {
  bigLines('IL TUO NUMERO ORDINE:', columnsOf(ctx)).forEach(line => printer.align('CT').size(2, 2).style('B').text(line).size(1, 1).style('NORMAL'));
  printer.feed(1);

  const banner = await ctx.images.numberBanner(order.display_code, 'slip');
  if (banner) printer.image(banner, { align: 'center' });
  else textBigNumber(printer, order.display_code, columnsOf(ctx));

  printer.feed(2);
  printer.cut();
}

// "TAVOLO T5 · 4 COPERTI" per le comande dei tavoli; nulla per gli ordini pagati subito.
export function tableLabel(order) {
  if (!order.table_name) return null;
  const covers = order.covers > 0 ? ` · ${order.covers} ${order.covers === 1 ? 'COPERTO' : 'COPERTI'}` : '';
  return `TAVOLO ${order.table_name}${covers}`.toUpperCase();
}

// Il tavolo in evidenza in cima alla copia, dove la cucina guarda per prima.
function renderTableBanner(printer, order, columns) {
  const label = tableLabel(order);
  if (!label) return;
  const room = Math.floor(columns / 2);   // lettere doppie: metà colonne; un po' d'aria ai lati della banda solo se avanza posto
  bigLines(label, columns).forEach(line => printer.align('CT').reverse(true).size(2, 2).style('B').text(line.length + 2 <= room ? ` ${line} ` : line).size(1, 1).style('NORMAL').reverse(false));
  // La portata (comande dei tavoli divise per uscita): subito sotto il tavolo
  if (order.course_name) wrapText(String(order.course_name).toUpperCase(), columns).forEach(line => printer.align('CT').size(1, 2).style('B').text(line).size(1, 1).style('NORMAL'));
  printer.align('CT').text(rule(columns));
}

async function renderTopHeaderImage(printer, ctx, displayCode) {
  const banner = await ctx.images.numberBanner(displayCode, 'header');
  if (!banner) return;
  printer.image(banner, { align: 'center' });
  printer.feed(1);
}

async function renderHeader(printer, ctx, { title, subtitle = '', pickupStatus = null, showLogo = ctx.showLogo }) {
  if (showLogo) {
    const logo = await ctx.images.logo();
    if (logo) {
      printer.align('CT').image(logo, { align: 'center' });
      printer.feed(1);
    }
  }

  const columns = columnsOf(ctx);
  const { name, taxCode } = ctx.branding;
  if (name) wrapText(name, columns).forEach(line => printer.align('CT').style('B').text(line));
  if (taxCode) wrapText(taxCode, columns).forEach(line => printer.align('CT').style('NORMAL').text(line));
  if (name || taxCode) printer.align('CT').text(rule(columns));

  wrapText(title, columns).forEach(line => printer.align('CT').style('B').text(line));
  printer.style('NORMAL');
  printer.align('CT').text(rule(columns));

  if (subtitle && !pickupStatus) {
    wrapText(subtitle, columns).forEach(line => printer.align('CT').style('B').text(line));
    printer.style('NORMAL');
    printer.align('CT').text(rule(columns));
  }

  printPickupBanner(printer, pickupStatus, subtitle, columns);
}

function renderItems(printer, ctx, items, layoutType = 'standard', bigFont = false) {
  const { itemHeader, amountHeader } = ctx.branding;
  const columns = columnsOf(ctx);
  if (layoutType === 'customer') {
    printer.align('LT').text(rowThreeColumns(itemHeader, 'QTA', amountHeader, columns));
    printer.align('CT').text(rule(columns));

    const maxTextWidth = columns - 8 - 4 - 2;
    items.forEach((item) => {
      const qty = String(item.quantity).trim();
      const rowTotal = money(item.line_total ?? parseFloat(item.price || 0) * item.quantity);
      wrapText(item.name.toUpperCase(), maxTextWidth).forEach((line, i) => {
        if (i === 0) printer.align('LT').text(rowThreeColumns(line, qty, rowTotal, columns));
        else printer.align('LT').text(line);
      });
      renderDetails(printer, item, columns);
    });
  } else {
    if (!bigFont) {
      printer.align('LT').text(rowLR(itemHeader, 'QTA', columns));
      printer.align('CT').text(rule(columns));
    }

    const maxTextWidth = columns - 4;
    const isAssociation = layoutType === 'association';
    items.forEach((item) => {
      const qty = String(item.quantity).trim();
      if (bigFont) {
        // Carattere doppio: metà colonne. Un nome lungo va a capo (il ritiro non deve perdere pezzi del nome)
        const maxW = Math.max(1, Math.floor((columns - qty.length - 2) / 2));
        wrapText(item.name.toUpperCase(), maxW).forEach((line, i) => {
          printer.align('LT').size(2, 2).style('B').text(i === 0 ? `${qty}x ${line}` : `${' '.repeat(qty.length + 2)}${line}`).size(1, 1).style('NORMAL');
        });
        renderDetails(printer, item, columns);
        printer.align('CT').text(rule(columns));
        return;
      }
      wrapText(item.name.toUpperCase(), maxTextWidth).forEach((line, i) => {
        if (i === 0) {
          if (isAssociation) printer.align('LT').text(rowLR(line, qty, columns));
          else printer.align('LT').style('B').text(rowLR(line, qty, columns)).style('NORMAL');
        } else {
          printer.align('LT').text('  ' + line);
        }
      });
      renderDetails(printer, item, columns);
    });
  }
  printer.align('CT').text(rule(columns));
}

// Opzioni e nota di una riga, a capo nella larghezza dello scontrino (il rientro resta allineato)
function renderDetails(printer, item, columns) {
  const lines = [];
  if (item.modifiers?.length) lines.push(...wrapText(`+ ${item.modifiers.map(m => m.name).join(', ')}`, columns - 2).map(l => `  ${l}`));
  if (item.note) lines.push(...wrapText(`>> ${item.note}`, columns - 2).map(l => `  ${l}`));
  lines.forEach(l => printer.align('LT').text(l));
}

function printPickupBanner(printer, status, subtitle = '', columns = DEFAULT_COLUMNS) {
  if (status !== 'valid') return;
  let bannerText = 'VALIDO PER IL RITIRO';
  if (subtitle.toUpperCase().includes('GASTRONOMIA') || subtitle.toUpperCase().includes('CUCINA')) bannerText = 'RITIRO CUCINA';
  else if (subtitle.toUpperCase().includes('BAR')) bannerText = 'RITIRO BAR';
  printer.align('CT').font('font_a').reverse(true);
  bigLines(bannerText, columns).forEach(line => printer.size(2, 2).text(line));
  printer.style('NORMAL').reverse(false).size(1, 1).font('font_a');
  printer.align('CT').text(rule(columns));
}

function renderFooter(printer, ctx, { total, pickupId, showTotal = false }) {
  const { totalLabel, legalText } = ctx.branding;
  const columns = columnsOf(ctx);
  if (showTotal && total !== null && total !== undefined) {
    printer.align('CT').style('B').text(totalLabel).style('NORMAL');
    printer.align('CT').style('B').size(2, 2).text(money(total)).size(1, 1).style('NORMAL');
    printer.align('CT').text(rule(columns));

    const legalLines = legalText.split('\n').map(l => l.trim()).filter(Boolean).flatMap(l => wrapText(l, columns));
    if (legalLines.length) {
      legalLines.forEach(line => printer.align('CT').text(line));
      printer.align('CT').text(rule(columns));
    }
  }

  if (pickupId) printer.align('CT').text(`ID RITIRO: ${pickupId}`);

  printer.align('CT').text(rule(columns, '='));
  printer.align('CT').text('Powered by SmartEats');
  printer.feed(2);
  printer.cut();
}

async function renderCustomer(printer, order, ctx) {
  await renderHeader(printer, ctx, { title: ctx.branding.title });
  renderItems(printer, ctx, order.items, 'customer');
  if (order.is_takeaway) {
    printer.align('CT').style('B').text('[ DA ASPORTO ]').style('NORMAL');
    printer.align('CT').text(rule(columnsOf(ctx)));
  }
  renderFooter(printer, ctx, { total: order.total, pickupId: encodeOrderId(order.id, new Date(order.created_at)), showTotal: true });
}

async function renderAssociation(printer, order, ctx) {
  await renderHeader(printer, ctx, { title: ctx.branding.title, subtitle: 'COPIA INTERNA ASSOCIAZIONE' });
  renderItems(printer, ctx, order.items, 'association');
  renderFooter(printer, ctx, { total: order.total, pickupId: encodeOrderId(order.id, new Date(order.created_at)), showTotal: true });
}

async function renderKitchen(printer, order, ctx) {
  const items = filterItems(order.items, 'kitchen');
  if (!items.length) return;
  renderTableBanner(printer, order, columnsOf(ctx));
  await renderHeader(printer, ctx, { title: '=== COPIA CUCINA ===' });
  renderItems(printer, ctx, items, 'kitchen');
  renderFooter(printer, ctx, {});
}

async function renderGastronomy(printer, order, ctx) {
  const items = filterItems(order.items, 'kitchen');
  if (!items.length) return;

  await renderTopHeaderImage(printer, ctx, order.display_code);
  renderTableBanner(printer, order, columnsOf(ctx));

  if (order.is_takeaway) {
    printer.align('CT').reverse(true).size(2, 2).style('B').text(' DA ASPORTO ').size(1, 1).style('NORMAL').reverse(false);
    printer.align('CT').text(rule(columnsOf(ctx)));
  }

  await renderHeader(printer, ctx, {
    title: '*** COPIA OMAGGIO GASTRONOMICO ***', subtitle: 'RITIRO CUCINA', pickupStatus: 'valid', showLogo: false,
  });
  renderItems(printer, ctx, items, 'gastronomy', true);
  renderFooter(printer, ctx, { pickupId: encodeOrderId(order.id, new Date(order.created_at || Date.now())) });
}

async function renderBar(printer, order, ctx) {
  const items = filterItems(order.items, 'bar');
  if (!items.length) return;

  await renderTopHeaderImage(printer, ctx, order.display_code);
  renderTableBanner(printer, order, columnsOf(ctx));

  await renderHeader(printer, ctx, {
    title: '*** COPIA OMAGGIO BAR ***', subtitle: 'RITIRO BAR', pickupStatus: 'valid', showLogo: false,
  });
  renderItems(printer, ctx, items, 'bar', true);
  renderFooter(printer, ctx, { pickupId: encodeOrderId(order.id, new Date(order.created_at || Date.now())) });
}

const euro = money;
const METHOD_LABELS = { cash: 'Contanti', card: 'Carta', other: 'Altro' };

// Ricevuta NON fiscale di un conto di un tavolo (dati di GET /checks/:id/receipt): tutto il conto, oppure la quota
// di un solo pagamento. Non è una copia degli ordini: la stampa dal pannello del conto la invia alla stampante cliente.
export async function renderCheckReceipt(printer, receipt, ctx) {
  const { check, lines, payments, scope } = receipt;
  const columns = columnsOf(ctx);
  await renderHeader(printer, ctx, { title: scope === 'payment' ? 'RICEVUTA DI PAGAMENTO' : 'CONTO' });
  const where = [check.table_name && `Tavolo ${check.table_name}`, check.covers > 0 && `${check.covers} ${check.covers === 1 ? 'coperto' : 'coperti'}`, `Conto n. ${check.number}`]
    .filter(Boolean).join(' - ');
  wrapText(where, columns).forEach(line => printer.align('CT').text(line));
  printer.align('CT').text(rule(columns));

  renderItems(printer, ctx, lines.map(l => ({ name: l.name, quantity: l.quantity, line_total: l.amount })), 'customer');

  if (scope === 'payment') {
    const [payment] = payments;
    printer.align('CT').style('B').text(`PAGATO ${METHOD_LABELS[payment.method] ?? payment.method}`).style('NORMAL');
    printer.align('CT').style('B').size(2, 2).text(euro(payment.amount)).size(1, 1).style('NORMAL');
    if (receipt.due > 0) printer.align('CT').text(`Residuo del conto: ${euro(receipt.due)}`);
  } else {
    printer.align('CT').style('B').text('TOTALE').style('NORMAL');
    printer.align('CT').style('B').size(2, 2).text(euro(receipt.total)).size(1, 1).style('NORMAL');
    if (payments.length) {
      printer.align('CT').text(rule(columns));
      payments.forEach(p => printer.align('LT').text(rowLR(METHOD_LABELS[p.method] ?? p.method, euro(p.amount), columns)));
      printer.align('LT').style('B').text(rowLR('Residuo', euro(receipt.due), columns)).style('NORMAL');
    }
  }
  printer.align('CT').text(rule(columns));
  printer.align('CT').text('DOCUMENTO NON FISCALE');
  printer.align('CT').text('Powered by SmartEats');
  printer.feed(2);
  printer.cut();
}

// Nome della copia (copy_types.name) → template
export const TEMPLATES = {
  Numeretto: renderNumberSlip,
  Cliente: renderCustomer,
  Associazione: renderAssociation,
  Cucina: renderKitchen,
  'Ritiro Gastronomia': renderGastronomy,
  'Ritiro Bar': renderBar,
};
