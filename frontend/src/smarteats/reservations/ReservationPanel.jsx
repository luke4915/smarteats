import { useState } from 'react';
import { Phone, MessageCircle, Mail, Users, Clock, StickyNote, MoreVertical } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import PanelFrame from '../floor/PanelFrame';
import ActionMenu from '../../components/shared/ActionMenu';
import { btn, btnPrimary, btnDanger, input, label } from '../floor/ui';
import { STATUS, formatDay, whatsappLink, mailLink, telLink } from './rules';
import StatusChip from './StatusChip';
import WhatsAppStatus from '../notifications/WhatsAppStatus';

// Il dettaglio di una prenotazione nel pannello a destra: cosa fare dipende dallo stato (conferma o rifiuta una
// richiesta; assegna il tavolo; messaggio al cliente; arrivato; non si è presentato).
const ReservationPanel = ({ reservation: r, tableNames, onBack, onChanged, onTables, onEdit, onOpenCheck }) => {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState('');
  const [overbook, setOverbook] = useState(null);

  const act = async (path, body = {}) => {
    setBusy(true);
    try {
      const res = await fetchWithAuth(`/bookings/reservations/${r.id}/${path}`, { method: 'POST', body });
      showToast({ confirm: 'Prenotazione confermata', decline: 'Richiesta rifiutata', cancel: 'Prenotazione annullata', keep: 'Prenotazione mantenuta', 'no-show': 'Segnata come non presentata', arrived: 'Cliente accolto: conto aperto' }[path], 'success');
      onChanged(res.reservation ?? res, res.check);
      setDeclining(false); setOverbook(null);
    } catch (err) {
      if (err.code === 'NO_CAPACITY') setOverbook(err.message);
      else showToast(err.message, 'error');
    } finally { setBusy(false); }
  };

  const text = r.confirmation_message;
  const wa = whatsappLink(r.phone, text), mail = mailLink(r.email, 'Conferma prenotazione', text), tel = telLink(r.phone);
  const tables = tableNames(r.table_ids);
  const menu = ['requested', 'confirmed'].includes(r.status) && [
    { label: 'Modifica', icon: StickyNote, onClick: onEdit },
    r.status === 'confirmed' && { label: 'Non si è presentato', icon: Clock, onClick: () => act('no-show') },
    { label: 'Annulla la prenotazione', icon: MoreVertical, danger: true, onClick: () => act('cancel') },
  ];

  return (
    <PanelFrame title={r.customer_name} subtitle={`${formatDay(r.date, { short: true })} · ${r.start_time}`} onBack={onBack} actions={menu && <ActionMenu items={menu} />}
      footer={
        r.status === 'requested' ? (
          declining ? (
            <div className="space-y-2">
              <input className={input} autoFocus placeholder="Motivo (facoltativo)" maxLength={200} value={reason} onChange={e => setReason(e.target.value)} onKeyDown={e => e.key === 'Enter' && act('decline', { reason })} />
              <div className="grid grid-cols-2 gap-2"><button className={btn} onClick={() => setDeclining(false)}>Indietro</button><button className={btnDanger} disabled={busy} onClick={() => act('decline', { reason })}>Rifiuta</button></div>
            </div>
          ) : overbook ? (
            <div className="space-y-2">
              <p className="text-sm text-amber-500">{overbook}. Confermare comunque?</p>
              <div className="grid grid-cols-2 gap-2"><button className={btn} onClick={() => setOverbook(null)}>No</button><button className={btnPrimary} disabled={busy} onClick={() => act('confirm', { ignore_capacity: true })}>Conferma comunque</button></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button className={btn} disabled={busy} onClick={() => setDeclining(true)}>Rifiuta</button>
              <button className={btnPrimary} disabled={busy} onClick={() => act('confirm')}>Conferma</button>
            </div>
          )
        ) : r.status === 'confirmed' && r.cancel_requested_at ? (
          <div className="grid grid-cols-2 gap-2">
            <button className={btn} disabled={busy} onClick={() => act('keep')}>Mantieni</button>
            <button className={btnDanger} disabled={busy} onClick={() => act('cancel')}>Conferma l'annullo</button>
          </div>
        ) : r.status === 'confirmed' ? (
          r.table_ids.length
            ? <button className={`${btnPrimary} w-full !h-12`} disabled={busy} onClick={() => act('arrived')}>Arrivato · apri il conto</button>
            : <button className={`${btnPrimary} w-full !h-12`} onClick={onTables}>Assegna un tavolo</button>
        ) : r.status === 'seated' && r.check_id ? (
          <button className={`${btn} w-full`} onClick={onOpenCheck}>Vai al tavolo</button>
        ) : null
      }>
      <div className="px-1 space-y-4 pb-2">
        {r.status === 'confirmed' && r.cancel_requested_at && (
          <div className="rounded-lg border border-red-500/40 bg-red-500/5 p-3" role="status">
            <p className="text-sm font-medium text-[var(--text-main)]">Il cliente chiede di annullare</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">Se confermi, la prenotazione si annulla e il posto torna libero. Se la mantieni, il cliente resta prenotato: avvisalo tu.</p>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap"><StatusChip status={r.status} />
          <span className="text-sm text-[var(--text-muted)]">{r.shift_name} · {r.duration_minutes} min</span></div>

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
          <dt className="text-[var(--text-muted)] flex items-center gap-1.5"><Users size={14} />Persone</dt><dd className="text-[var(--text-main)] font-medium">{r.party_size}</dd>
          <dt className="text-[var(--text-muted)]">Tavoli</dt>
          <dd className="text-[var(--text-main)]">{tables.length ? tables.join(', ') : <span className="text-[var(--text-muted)]">non assegnati</span>}
            {['requested', 'confirmed'].includes(r.status) && <button className="ml-2 text-[var(--accent)] text-sm font-medium cursor-pointer" onClick={onTables}>{tables.length ? 'Cambia' : 'Assegna'}</button>}</dd>
          <dt className="text-[var(--text-muted)]">Telefono</dt><dd className="text-[var(--text-main)]">{r.phone || '—'}</dd>
          {r.email && <><dt className="text-[var(--text-muted)]">Email</dt><dd className="text-[var(--text-main)] break-all">{r.email}</dd></>}
          {r.notes && <><dt className="text-[var(--text-muted)]">Note</dt><dd className="text-[var(--text-main)]">{r.notes}</dd></>}
          <dt className="text-[var(--text-muted)]">Provenienza</dt><dd className="text-[var(--text-main)]">{({ staff: 'Inserita a mano', portal: 'Portale' })[r.source] ?? r.source}</dd>
          {r.decline_reason && <><dt className="text-[var(--text-muted)]">Motivo</dt><dd className="text-[var(--text-main)]">{r.decline_reason}</dd></>}
        </dl>

        <WhatsAppStatus refType="reservation" refId={r.id} version={r.status + (r.cancel_requested_at ?? '')} />

        {['confirmed', 'requested'].includes(r.status) && (r.phone || r.email) && (
          <section className="rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] p-3 space-y-3">
            <p className={label}>Avvisa il cliente</p>
            <p className="text-sm text-[var(--text-main)] leading-snug">{text}</p>
            <div className="grid grid-cols-3 gap-2">
              {wa ? <a className={`${btn} !h-10 !px-2`} href={wa} target="_blank" rel="noreferrer"><MessageCircle size={16} />WhatsApp</a> : <span />}
              {tel ? <a className={`${btn} !h-10 !px-2`} href={tel}><Phone size={16} />Chiama</a> : <span />}
              {mail ? <a className={`${btn} !h-10 !px-2`} href={mail}><Mail size={16} />Email</a> : <span />}
            </div>
            <button className="text-sm text-[var(--accent)] font-medium cursor-pointer" onClick={() => navigator.clipboard?.writeText(text).then(() => showToast('Messaggio copiato', 'success'))}>Copia il messaggio</button>
          </section>
        )}
      </div>
    </PanelFrame>
  );
};

export default ReservationPanel;
