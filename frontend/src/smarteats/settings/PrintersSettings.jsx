import { useState, useEffect, useCallback } from 'react';
import { ChefHat, Wine, Receipt } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { refreshPrintConfig } from '../../print/config';
import { useToast } from '../../context/useToast';
import Switch from '../../components/shared/Switch';
import Loading from '../../components/shared/Loading';
import PrinterCheck from '../../components/setup/PrinterCheck';
import { input } from '../floor/ui';
import { PRINTERS, settingFor, isReady } from './printers';

// Dove stampa il ristorante: una riga per la cucina, una per il bar, una per il conto. Ogni riga ha l'indirizzo della stampante (si
// trova sul foglio di prova o nel menu della stampante), un interruttore e la prova. Dietro le quinte sono le stesse «copie» di stampa della
// cassa delle sagre: la prima volta che si usa una riga si crea la copia. La stampante va autorizzata una volta per ogni dispositivo.
const ICONS = { kitchen: ChefHat, bar: Wine, check: Receipt };

const PrinterRow = ({ printer, setting, saving, onSave }) => {
  const Icon = ICONS[printer.id];
  const [address, setAddress] = useState(setting?.printer_address ?? '');
  useEffect(() => { setAddress(setting?.printer_address ?? ''); }, [setting?.printer_address]);

  return (
    <li className="px-4 py-3.5 space-y-3">
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 shrink-0 rounded-lg bg-[var(--bg-card-2)] text-[var(--text-muted)] flex items-center justify-center"><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[var(--text-main)]">{printer.label}</p>
          <p className="text-xs text-[var(--text-muted)]">{printer.hint}</p>
        </div>
        <Switch label={`${printer.label}: stampa attiva`} checked={!!setting?.enabled} disabled={saving || (!setting?.printer_address && !address.trim())}
          onChange={(on) => onSave(printer, { enabled: on, printer_address: address.trim() })} />
      </div>
      <div className="sm:pl-12 space-y-2">
        <input className={input} aria-label={`Indirizzo della stampante: ${printer.label}`} placeholder="Indirizzo della stampante (es. 192.168.1.100)" inputMode="url" autoCapitalize="none" autoCorrect="off"
          value={address} disabled={saving} onChange={e => setAddress(e.target.value)}
          onBlur={() => address.trim() !== (setting?.printer_address ?? '') && onSave(printer, { enabled: !!setting?.enabled && !!address.trim(), printer_address: address.trim() })} />
        {isReady(setting) && <PrinterCheck address={setting.printer_address} />}
      </div>
    </li>
  );
};

const PrintersSettings = () => {
  const { showToast } = useToast();
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(null);

  const load = useCallback(async () => {
    try { setSettings(await fetchWithAuth('/print-settings')); }
    catch (err) { showToast(err.message, 'error'); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  // Salva una stampante; se la sua copia non esiste ancora la crea (nasce spenta e senza indirizzo), poi aggiorna la configurazione del dispositivo.
  const save = async (printer, patch) => {
    setSaving(printer.id);
    try {
      let row = settingFor(printer, settings);
      if (!row) {
        await fetchWithAuth('/print-settings/copy-types', { method: 'POST', body: { name: printer.template, label: printer.label } });
        row = settingFor(printer, await fetchWithAuth('/print-settings'));
      }
      await fetchWithAuth(`/print-settings/${row.id}`, { method: 'PUT', body: { printer_type: 'network', ...patch } });
      await load();
      refreshPrintConfig().catch(() => { /* offline: si aggiorna al ritorno della rete */ });
    } catch (err) { showToast(err.message, 'error'); await load(); }
    finally { setSaving(null); }
  };

  if (!settings) return <Loading />;
  return (
    <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)]">
      <div className="p-5 pb-3">
        <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Stampanti</h2>
        <p className="text-xs text-[var(--text-muted)] max-w-xl">Scrivi l'indirizzo di ogni stampante e accendila. La prima volta, su ogni dispositivo, tocca «Autorizza» e poi «Stampa di prova». Chi non ha stampanti può lasciare tutto spento.</p>
      </div>
      <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
        {PRINTERS.map(p => <PrinterRow key={p.id} printer={p} setting={settingFor(p, settings)} saving={saving === p.id} onSave={save} />)}
      </ul>
    </div>
  );
};

export default PrintersSettings;
