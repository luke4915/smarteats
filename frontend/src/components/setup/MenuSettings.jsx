import { useState, useEffect } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Copy, ExternalLink, Download } from 'lucide-react';
import { useToast } from '../../context/useToast';
import { apiFetch } from '../../utils/apiClient';
import { btn } from '../../smarteats/floor/ui';

// Il menu pubblico con il QR (sagre e paninari): il QR da stampare e mettere sul banco, il link da condividere e il messaggio di benvenuto
// che i clienti leggono. Il messaggio non si scrive qui: è una funzione che imposta l'assistenza (pannello master), qui si vede soltanto.
const MenuSettings = () => {
  const { showToast } = useToast();
  const [welcome, setWelcome] = useState(null);
  const link = `${window.location.origin}/menu`;

  useEffect(() => {
    // Stesso endpoint pubblico letto dal menu con QR.
    apiFetch('/settings').then(data => setWelcome(data.welcome_message || '')).catch(() => setWelcome(''));
  }, []);

  const copy = async () => {
    try { await navigator.clipboard.writeText(link); showToast('Link copiato', 'success'); } catch { showToast('Copia non riuscita', 'warning'); }
  };
  const download = () => {
    const a = document.createElement('a');
    a.href = document.getElementById('menu-qr')?.toDataURL('image/png') ?? '';
    a.download = 'menu-qr.png';
    a.click();
  };

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]">
      <div className="grid sm:grid-cols-[auto_1fr] gap-6 items-start max-w-3xl">
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-white rounded-xl"><QRCodeCanvas id="menu-qr" value={link} size={160} /></div>
          <div className="flex flex-wrap justify-center gap-1.5">
            <button className={btn} onClick={download}><Download size={15} /> Scarica</button>
            <button className={btn} onClick={copy}><Copy size={15} /> Copia il link</button>
            <a className={btn} href={link} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Apri</a>
          </div>
        </div>
        <div className="space-y-4 min-w-0">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Come funziona</h2>
            <p className="text-sm text-[var(--text-muted)]">Stampa il QR e mettilo dove si fa la coda. I clienti scelgono i prodotti dal telefono e mostrano alla cassa un altro QR con il loro ordine: i prezzi li ricalcola la cassa.</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Messaggio di benvenuto</h2>
            {welcome === null ? null : welcome
              ? <p className="text-sm text-[var(--text-main)] whitespace-pre-line rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] px-3 py-2.5">{welcome}</p>
              : <p className="text-sm text-[var(--text-muted)]">Nessun messaggio. Se vuoi un testo di benvenuto sul menu (nome della sagra, orari, avvisi), chiedilo all'assistenza.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuSettings;
