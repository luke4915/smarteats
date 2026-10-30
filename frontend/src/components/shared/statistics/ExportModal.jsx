import { useState } from 'react';
import { Download } from 'lucide-react';
import { fetchWithAuth } from '../../../utils/apiClient';
import { useToast } from '../../../context/useToast';
import Modal from '../Modal';
import Segmented from '../../../smarteats/floor/Segmented';
import { iconBtn } from '../../../smarteats/floor/ui';
import { downloadSessionReport } from './sessionReportPdf';

// «Esporta una serata»: si sceglie il formato (report PDF per leggere e stampare, CSV delle righe o dei prodotti per Excel) e si scarica
// la serata voluta. Il PDF si costruisce sul dispositivo dai numeri calcolati dal server; i CSV li prepara il server.
const FORMATS = [
  { id: 'pdf', label: 'Report PDF' },
  { id: 'lines', label: 'CSV righe' },
  { id: 'products', label: 'CSV prodotti' },
];
const HINTS = {
  pdf: 'Un foglio da leggere o stampare: incasso, cassa, pagamenti, prodotti e andamento.',
  lines: 'Una riga per ogni piatto venduto, con cassa o tavolo, omaggi e sconti.',
  products: 'Una riga per prodotto: quanti ne hai venduti e quanto hanno incassato.',
};
const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const ExportModal = ({ sessions, terms, onClose }) => {
  const { showToast } = useToast();
  const [format, setFormat] = useState('pdf');
  const [busy, setBusy] = useState(null);

  const run = async (session) => {
    setBusy(session.id);
    try {
      if (format === 'pdf') {
        downloadSessionReport(await fetchWithAuth(`/exports/session/${session.id}/report?tz=${encodeURIComponent(TZ)}`), { noun: terms.unit });
      } else {
        const res = await fetchWithAuth(`/exports/session/${session.id}/csv?type=${format}&tz=${encodeURIComponent(TZ)}`, { raw: true });
        const name = /filename=([^;]+)/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? `${terms.unit}-${session.id}.csv`;
        download(await res.blob(), name);
      }
      onClose();
    } catch (err) {
      showToast(`Impossibile scaricare: ${err.message}`, 'error');
    } finally { setBusy(null); }
  };

  return (
    <Modal title={`Esporta una ${terms.unit}`} size="max-w-md" onClose={onClose}>
      <div className="space-y-3">
        <Segmented scroll label="Formato" value={format} onChange={setFormat} options={FORMATS} />
        <p className="text-xs text-[var(--text-muted)]">{HINTS[format]}</p>
        <div className="space-y-2">
          {sessions.length === 0 ? (
            <p className="text-sm text-center text-[var(--text-muted)] py-6">{terms.none}</p>
          ) : sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)]">
              <div className="min-w-0 flex-1 pr-2">
                <p className="text-sm font-medium text-[var(--text-main)] truncate">{s.name || `${terms.column} ${s.id}`}</p>
                <p className="text-xs text-[var(--text-muted)]">
                  {s.end_time ? `Chiusa il ${new Date(s.end_time).toLocaleDateString('it-IT')} alle ${new Date(s.end_time).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : 'In corso'}
                </p>
              </div>
              <button onClick={() => run(s)} disabled={busy !== null} aria-label={`Scarica ${s.name || s.id}`} className={`${iconBtn} shrink-0`}><Download size={16} /></button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

export default ExportModal;
