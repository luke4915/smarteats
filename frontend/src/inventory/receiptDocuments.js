// Invio degli allegati di uno scarico (foto o PDF della bolla) e indirizzo per aprirli. Il file va come corpo grezzo, col suo
// tipo nell'intestazione e il nome in `X-File-Name`.
import { fetchWithAuth } from '../utils/apiClient';
import { API_URL } from '../config/api';

// Invia i file uno dopo l'altro. Ritorna i nomi di quelli che non sono partiti (l'elenco vuoto = tutto bene).
export async function uploadReceiptDocuments(receiptId, files) {
  const failed = [];
  for (const { blob, name } of files) {
    try {
      await fetchWithAuth(`/goods-receipts/${receiptId}/documents`, { method: 'PUT', body: blob, headers: { 'Content-Type': blob.type, 'X-File-Name': encodeURIComponent(name) } });
    } catch { failed.push(name); }
  }
  return failed;
}

// Dove si apre un allegato (il browser manda da solo il cookie di accesso).
export const documentUrl = (receiptId, documentId) => `${API_URL}/goods-receipts/${receiptId}/documents/${documentId}`;
