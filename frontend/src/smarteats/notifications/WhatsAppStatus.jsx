import { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useAuth } from '../../context/useAuth';

// Lo stato degli avvisi WhatsApp di una prenotazione o di un ordine, in sola lettura: «Confermata · consegnato alle
// 19:02». Se un invio è fallito, il personale può rimandarlo. Compare solo nei locali con il modulo acceso.
const EVENT = {
  received: 'Ricevuta', confirmed: 'Confermata', reminder: 'Promemoria', declined: 'Rifiutata', cancelled: 'Annullata', kept: 'Annullo non accettato',
  expired: 'Scaduta', accepted: 'Confermato', ready: 'Pronto', picked_up: 'Ritirato', rejected: 'Non accettato',
};
const STATUS = { queued: 'in coda', sent: 'inviato', delivered: 'consegnato', read: 'letto', failed: 'non inviato', skipped: 'non inviato' };
const REASON = { NUMERO_NON_VALIDO: 'numero non valido', TETTO_MENSILE: 'tetto raggiunto', GIA_GESTITA: 'già gestita', STATO_CAMBIATO: 'non più necessario', TURNO_PASSATO: 'turno passato' };

const WhatsAppStatus = ({ refType, refId, version = 0 }) => {
  const { user } = useAuth();
  const enabled = !!user.modules?.includes('whatsapp');
  const [items, setItems] = useState(null);
  const load = useCallback(() => fetchWithAuth(`/whatsapp/messages?ref_type=${refType}&ref_id=${refId}`).then(setItems).catch(() => setItems([])), [refType, refId]);
  useEffect(() => { if (enabled) load(); }, [enabled, load, version]);

  const visible = (items ?? []).filter(m => m.status !== 'skipped' || ['NUMERO_NON_VALIDO', 'TETTO_MENSILE'].includes(m.error));
  if (!enabled || !visible.length) return null;
  return (
    <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] p-3" aria-label="Avvisi WhatsApp">
      <p className="text-xs font-medium text-[var(--text-muted)] flex items-center gap-1.5 mb-2"><MessageCircle size={13} /> Avvisi WhatsApp</p>
      <ul className="space-y-1.5">
        {visible.map(m => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            <span className="text-[var(--text-main)]">{EVENT[m.event] ?? m.event}</span>
            <span className={`text-xs ${m.status === 'failed' || m.status === 'skipped' ? 'text-red-500' : 'text-[var(--text-muted)]'}`}>
              {STATUS[m.status]}{m.error ? ` · ${REASON[m.error] ?? m.error}` : ''}
            </span>
            {m.status === 'failed' && (
              <button className="ml-auto text-xs text-[var(--accent)] font-medium cursor-pointer"
                onClick={async () => { await fetchWithAuth(`/whatsapp/messages/${m.id}/retry`, { method: 'POST', body: {} }).catch(() => {}); load(); }}>Rimanda</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default WhatsAppStatus;
