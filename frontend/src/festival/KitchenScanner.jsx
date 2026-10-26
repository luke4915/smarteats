import { useEffect, useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { BrowserMultiFormatReader, NotFoundException } from '@zxing/library';
import { useToast } from '../context/useToast';
import { fetchWithAuth } from '../utils/apiClient';
import Modal from '../components/shared/Modal';
import { btn } from '../smarteats/floor/ui';

// Il codice a barre dello scontrino ha la forma `ORD` + id in base 36: un colpo di fotocamera e l'ordine è pronto.
const parseBarcode = (code) => {
  if (!code.startsWith('ORD')) return null;
  const id = parseInt(code.slice(3, 9), 36);
  return Number.isNaN(id) ? null : id;
};

// «Scansiona scontrino» per la cucina della sagra: apre la fotocamera in una finestra e, letto il codice, segna l'ordine
// come completato. La lista della cucina si aggiorna da sola (evento `order_updated`).
const KitchenScanner = () => {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const video = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const reader = new BrowserMultiFormatReader();
    let stream = null;
    let stopped = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) { setError('Fotocamera non disponibile.'); return; }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped || !video.current) { stream.getTracks().forEach(t => t.stop()); return; }
        video.current.srcObject = stream;
        await video.current.play();
        reader.decodeFromVideoDevice(null, video.current, async (result, err) => {
          if (result) {
            const id = parseBarcode(result.text);
            if (!id) return setError('Codice non valido.');
            setOpen(false);
            try { await fetchWithAuth(`/orders/${id}`, { method: 'PUT', body: { status: 'completed' } }); showToast('Ordine completato!', 'success'); }
            catch (e) { showToast(`Errore aggiornamento ordine: ${e.message}`, 'error'); }
          } else if (err && !(err instanceof NotFoundException)) setError('Errore lettura codice.');
        });
      } catch { setError('Errore accesso fotocamera.'); }
    })();
    return () => { stopped = true; reader.reset(); stream?.getTracks().forEach(t => t.stop()); };
  }, [open, showToast]);

  return (
    <>
      <button onClick={() => { setError(''); setOpen(true); }} aria-label="Scansiona scontrino" className={`${btn} !h-12`}><Camera size={18} /> <span className="hidden sm:inline">Scansiona scontrino</span></button>
      {open && (
        <Modal title="Scansiona lo scontrino" onClose={() => setOpen(false)}>
          <div className="relative w-full aspect-video rounded-lg overflow-hidden border-2 border-[var(--accent)]">
            <video ref={video} className="w-full h-full object-cover" playsInline muted />
          </div>
          {error && <p className="mt-3 text-sm font-medium text-red-500">{error}</p>}
        </Modal>
      )}
    </>
  );
};

export default KitchenScanner;
