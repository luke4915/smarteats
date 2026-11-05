// Le misure di uno scontrino: quante lettere stanno in una riga, righe a due o tre colonne, testo che va a capo. Pura, senza stampante.
export const DEFAULT_COLUMNS = 42;
export const columnsOf = (ctx) => ctx.columns ?? DEFAULT_COLUMNS;
export const rule = (columns, char = '-') => char.repeat(columns);

// Testo a caratteri ingranditi: ogni lettera occupa `scale` colonne, quindi si va a capo prima (e si sta sempre nella riga)
export const bigLines = (text, columns, scale = 2) => wrapText(text, Math.max(1, Math.floor(columns / scale)));

// Importi come si scrivono in Italia: virgola dei decimali (la stampante non ha il separatore del browser).
export const money = (n) => `€ ${Number(n).toFixed(2).replace('.', ',')}`;

export function wrapText(text, width) {
  const words = text.split(' ');
  const lines = [];
  let current = '';
  words.forEach((word) => {
    if ((current + word).length > width) {
      if (current) lines.push(current.trimEnd());
      current = word + ' ';
    } else {
      current += word + ' ';
    }
  });
  if (current.trim()) lines.push(current.trimEnd());
  return lines.length ? lines : [text.slice(0, width)];
}

export function rowLR(left, right, width) {
  const firstWidth = Math.max(1, width - 1 - right.length);
  return `${left.slice(0, firstWidth).padEnd(firstWidth)} ${right}`;
}

export function rowThreeColumns(left, center, right, width) {
  const rightWidth = 8;
  const centerWidth = 4;
  const leftWidth = width - rightWidth - centerWidth - 2;
  return `${left.slice(0, leftWidth).padEnd(leftWidth)} ${center.padStart(centerWidth)} ${right.padStart(rightWidth)}`;
}

