// Prepara un file della bolla prima di inviarlo: le foto dei telefoni pesano parecchi MB, quindi si riducono (lato lungo
// 1800 px, JPEG) e restano leggibili; i PDF passano così come sono. Il server rifiuta comunque oltre gli 8 MB.
const MAX_SIDE = 1800;
const MAX_BYTES = 8 * 1024 * 1024;

async function shrinkImage(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return new Promise((resolve, reject) => canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('conversione non riuscita'))), 'image/jpeg', 0.82));
}

// Ritorna { blob, name } pronto per l'invio, o lancia un Error con un messaggio per l'utente.
export async function prepareDocument(file) {
  if (file.type === 'application/pdf') {
    if (file.size > MAX_BYTES) throw new Error('Il PDF supera gli 8 MB');
    return { blob: file, name: file.name };
  }
  if (!file.type.startsWith('image/')) throw new Error('Allega una foto o un PDF');
  let blob = file;
  try { blob = await shrinkImage(file); } catch { /* formato che il browser non sa leggere (es. HEIC): si prova ad inviarlo com'è */ }
  if (blob.size > MAX_BYTES) throw new Error('La foto è troppo grande');
  return { blob, name: blob === file ? file.name : file.name.replace(/\.[^.]+$/, '') + '.jpg' };
}
