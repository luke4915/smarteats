import test from 'node:test';
import assert from 'node:assert/strict';
import { sniffDocumentType, safeFileName } from '../utils/inventory/documents.js';

const withHead = (bytes) => Buffer.concat([Buffer.from(bytes), Buffer.alloc(32)]);

test('si riconosce il tipo dal contenuto, non dal nome', () => {
  assert.equal(sniffDocumentType(withHead([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffDocumentType(withHead([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffDocumentType(withHead([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31])), 'application/pdf');
  const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)]);
  assert.equal(sniffDocumentType(webp), 'image/webp');
});

test('un file travestito o troppo corto non passa', () => {
  assert.equal(sniffDocumentType(Buffer.from('<html><script>alert(1)</script></html>')), null);
  assert.equal(sniffDocumentType(Buffer.from([0xff, 0xd8])), null);
  assert.equal(sniffDocumentType(null), null);
});

test('il nome del file: niente percorsi né caratteri strani, al massimo 120 caratteri', () => {
  assert.equal(safeFileName(encodeURIComponent('bolla rossi.jpg')), 'bolla rossi.jpg');
  assert.equal(safeFileName(encodeURIComponent('../../etc/passwd')), '.._.._etc_passwd'.replace(/^\.+/, ''));
  assert.equal(safeFileName(undefined), 'bolla');
  assert.equal(safeFileName('%E0%A4%A'), 'bolla', 'codifica rovinata: nome di riserva');
  assert.equal(safeFileName('x'.repeat(300)).length, 120);
});
