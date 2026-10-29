import { useState, useEffect, useCallback } from 'react';
import { Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { btn, btnPrimary, iconBtn, input, label } from '../floor/ui';
import Switch from '../../components/shared/Switch';
import Loading from '../../components/shared/Loading';

const DAYS = [[1, 'Lunedì'], [2, 'Martedì'], [3, 'Mercoledì'], [4, 'Giovedì'], [5, 'Venerdì'], [6, 'Sabato'], [0, 'Domenica']];
const SLOT_OPTIONS = [10, 15, 20, 30, 60];
const link = () => `${window.location.origin}/order`;

// Impostazioni dell'asporto (solo admin): orari in cui si accettano ordini, durata delle fasce, quante porzioni per
// fascia (il forno ha un limite), anticipo minimo, e la pagina dei clienti con il suo QR.
const TakeawaySettings = () => {
  const { showToast } = useToast();
  const [s, setS] = useState(null);
  const [hours, setHours] = useState([]);
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchWithAuth('/takeaway/settings');
      setS(data); setHours(data.hours.map(h => ({ weekday: h.weekday, open_time: h.open_time, close_time: h.close_time }))); setDirty(false);
    } catch (err) { showToast(err.message, 'error'); }
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  const save = async (key, value, message) => {
    try { await fetchWithAuth(`/settings/${key}`, { method: 'PUT', body: { value: value === '' ? null : String(value) } }); if (message) showToast(message, 'success'); }
    catch (err) { showToast(err.message, 'error'); load(); }
  };
  const saveHours = async () => {
    try { await fetchWithAuth('/takeaway/hours', { method: 'PUT', body: { hours } }); showToast('Orari salvati', 'success'); setDirty(false); }
    catch (err) { showToast(err.message, 'error'); }
  };
  const setWindow = (weekday, index, patch) => { setHours(h => { let n = -1; return h.map(w => (w.weekday === weekday && ++n === index ? { ...w, ...patch } : w)); }); setDirty(true); };
  const addWindow = (weekday) => { setHours(h => [...h, { weekday, open_time: '18:00', close_time: '22:00' }]); setDirty(true); };
  const removeWindow = (weekday, index) => { setHours(h => { let n = -1; return h.filter(w => !(w.weekday === weekday && ++n === index)); }); setDirty(true); };
  const copyToAll = (weekday) => {
    const source = hours.filter(w => w.weekday === weekday);
    setHours(source.length ? DAYS.flatMap(([d]) => source.map(w => ({ ...w, weekday: d }))) : []);
    setDirty(true);
  };

  if (!s) return <section className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]"><Loading /></section>;

  return (
    <section className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)] space-y-6" aria-label="Asporto">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text-main)] mb-1">Asporto</h2>
        <p className="text-xs text-[var(--text-muted)]">I clienti ordinano dal sito scegliendo l'orario di ritiro; ogni ordine lo approvi tu. Si paga al ritiro.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_auto] gap-6 max-w-3xl">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch checked={s.enabled} label="Ordini online"
              onChange={(enabled) => { setS(x => ({ ...x, enabled })); save('takeaway_portal_enabled', enabled ? '1' : '0', enabled ? 'Ordini online accesi' : 'Ordini online spenti'); }} />
            <span className="text-sm text-[var(--text-main)]">{s.enabled ? 'Accesi: i clienti possono ordinare dal sito' : 'Spenti: la pagina non è raggiungibile'}</span>
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div><label className={label} htmlFor="tk-slot">Durata di una fascia</label>
              <select id="tk-slot" className={`${input} mt-1`} value={s.slotMinutes} onChange={e => { setS(x => ({ ...x, slotMinutes: Number(e.target.value) })); save('takeaway_slot_minutes', e.target.value, 'Fasce aggiornate'); }}>
                {SLOT_OPTIONS.map(m => <option key={m} value={m}>{m} minuti</option>)}
              </select></div>
            <div><label className={label} htmlFor="tk-cap">Minuti di lavoro per fascia</label>
              <input id="tk-cap" type="number" min="1" max="999" className={`${input} mt-1`} value={s.capacity}
                onChange={e => setS(x => ({ ...x, capacity: e.target.value }))} onBlur={e => e.target.value && save('takeaway_slot_capacity', e.target.value, 'Capienza aggiornata')} /></div>
            <div><label className={label} htmlFor="tk-lead">Anticipo minimo (minuti)</label>
              <input id="tk-lead" type="number" min="0" max="240" step="5" className={`${input} mt-1`} value={s.minLeadMinutes}
                onChange={e => setS(x => ({ ...x, minLeadMinutes: e.target.value }))} onBlur={e => e.target.value !== '' && save('takeaway_min_lead_minutes', e.target.value, 'Anticipo aggiornato')} /></div>
          </div>
          <p className="text-xs text-[var(--text-muted)] -mt-1">
            Ogni ordine occupa tanti minuti di lavoro quanti ne servono a prepararlo: il tempo di ogni piatto si imposta nella Carta (le bevande valgono 0).
            {Number(s.capacity) > 0 && <> Con {s.capacity} minuti per fascia ci stanno circa {Math.floor(Number(s.capacity) / 5)} piatti da 5 minuti.</>}
          </p>
          <div><label className={label} htmlFor="tk-phone">Telefono per gli ordini (mostrato ai clienti)</label>
            <input id="tk-phone" className={`${input} mt-1`} value={s.phone} maxLength={40} placeholder="Es. 0123 456789"
              onChange={e => setS(x => ({ ...x, phone: e.target.value }))} onBlur={e => save('takeaway_phone', e.target.value.trim())} /></div>
          <div><label className={label} htmlFor="tk-welcome">Messaggio nella pagina degli ordini (facoltativo)</label>
            <textarea id="tk-welcome" className={`${input} mt-1 !h-20 py-2`} value={s.welcome} maxLength={500} placeholder="Es. Il forno a legna parte alle 18:30."
              onChange={e => setS(x => ({ ...x, welcome: e.target.value }))} onBlur={e => save('takeaway_welcome', e.target.value.trim())} /></div>
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="p-2 bg-white rounded-lg"><QRCodeSVG value={link()} size={120} /></div>
          <p className="text-xs text-[var(--text-muted)] break-all max-w-[140px] text-center">{link()}</p>
          <div className="flex gap-1.5">
            <button className={btn} onClick={async () => { try { await navigator.clipboard.writeText(link()); showToast('Link copiato', 'success'); } catch { showToast('Copia non riuscita', 'warning'); } }}><Copy size={15} /> Copia</button>
            <a className={btn} href={link()} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Apri</a>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-[var(--text-main)] mb-1">Orari di ritiro</h3>
        <p className="text-xs text-[var(--text-muted)] mb-3">In quali orari si può ritirare. Un giorno senza orari è chiuso per l'asporto. L'ultima fascia comincia prima della chiusura.</p>
        <ul className="max-w-2xl divide-y divide-[var(--border)] border border-[var(--border)] rounded-lg">
          {DAYS.map(([d, name]) => {
            const windows = hours.filter(w => w.weekday === d);
            return (
              <li key={d} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5">
                <span className="w-24 text-sm font-medium text-[var(--text-main)]">{name}</span>
                <div className="flex-1 min-w-[12rem] space-y-1.5">
                  {windows.length === 0 && <span className="text-sm text-[var(--text-muted)]">Chiuso</span>}
                  {windows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input type="time" aria-label={`${name}: apertura`} className={`${input} !h-9 !w-28 coarse:!w-36`} value={w.open_time} onChange={e => setWindow(d, i, { open_time: e.target.value })} />
                      <span className="text-[var(--text-muted)]">–</span>
                      <input type="time" aria-label={`${name}: chiusura`} className={`${input} !h-9 !w-28 coarse:!w-36`} value={w.close_time} onChange={e => setWindow(d, i, { close_time: e.target.value })} />
                      <button className={`${iconBtn} hover:!text-red-500`} aria-label={`Togli la fascia di ${name}`} onClick={() => removeWindow(d, i)}><Trash2 size={15} /></button>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-1">
                  <button className={iconBtn} aria-label={`Aggiungi un orario al ${name}`} onClick={() => addWindow(d)}><Plus size={16} /></button>
                  {windows.length > 0 && <button className="text-xs text-[var(--accent)] font-medium cursor-pointer px-1" onClick={() => copyToAll(d)}>Copia su tutti</button>}
                </div>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex items-center gap-3">
          <button className={btnPrimary} disabled={!dirty} onClick={saveHours}>Salva gli orari</button>
          {dirty && <span className="text-xs text-amber-500">Modifiche non salvate</span>}
        </div>
      </div>
    </section>
  );
};

export default TakeawaySettings;
