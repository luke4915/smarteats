// I file allegati ai carichi di merce (foto o PDF della bolla). Logica pura, provata in tests/documents.test.js.
// Il tipo dichiarato dal browser non basta: si guarda l'inizio del file, così un file travestito non passa.

export const MAX_DOCUMENT_BYTES = 8 * 1024 * 1024;
export const DOCUMENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
export const MAX_DOCUMENTS_PER_RECEIPT = 8;

const startsWith = (buffer, bytes, offset = 0) => bytes.every((b, i) => buffer[offset + i] === b);

// Che file è davvero, guardando i primi byte; null se non è un tipo ammesso.
export function sniffDocumentType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && startsWith(buffer, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  if (startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf';
  return null;
}

// Il nome del file come arriva nell'intestazione (testo codificato): niente percorsi né caratteri strani, al massimo 120 caratteri.
export function safeFileName(header, fallback = 'bolla') {
  let name = fallback;
  try { name = decodeURIComponent(String(header ?? '')); } catch { /* codifica rovinata: si usa il nome di riserva */ }
  name = name.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').replace(/^\.+/, '').trim().slice(0, 120);
  return name || fallback;
}
