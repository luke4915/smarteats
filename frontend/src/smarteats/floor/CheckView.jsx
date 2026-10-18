import { useState } from 'react';
import { Plus, Send, Wallet, Lock, BellRing, BellOff, Percent, Printer, Trash2, ArrowRightLeft, Users } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import PanelFrame from './PanelFrame';
import ActionMenu from '../../components/shared/ActionMenu';
import CheckOrders from './CheckOrders';
import { formatEuro } from './checkMath';
import { printFired } from './printFired';
import { NO_COURSE_NAME } from './courses';
import { canCash, canDiscount as roleCanDiscount } from './permissions';
import { btn, btnPrimary, btnDanger, label } from './ui';

const METHOD = { cash: 'Contanti', card: 'Carta', other: 'Altro' };
const time = (iso) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });

// Il conto di un tavolo, nel pannello a destra: righe per comanda e due azioni sempre in vista (Aggiungi, Incassa).
// Tutto il resto sta nel menu «⋯».
const CheckView = ({ detail, user, service, onBack, onOrder, onPay, onAdjust, onMove, onCovers, onChanged, onDeleted, onPrint }) => {
  const { showToast } = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const open = detail.status === 'open';
  const activeOrders = detail.orders.filter(o => o.status !== 'canceled');
  // Il coperto è una riga automatica: non conta come comanda quando si decide se il conto è vuoto
  const realOrders = activeOrders.filter(o => o.order_type !== 'cover');
  const canDiscount = roleCanDiscount(user.role);
  const cash = canCash(user.role);
  const hasPayments = detail.payments.length > 0;
  const billRequested = open && detail.bill_requested_at;
  // «Contanti 10,00 € · Carta 12,00 €»: come si è pagato, in calce accanto al totale (se un solo metodo, basta il nome)
  const byMethod = detail.payments.reduce((m, p) => m.set(p.method, (m.get(p.method) ?? 0) + Number(p.amount)), new Map());
  const methods = [...byMethod].map(([k, v]) => (byMethod.size > 1 || open ? `${METHOD[k]} ${formatEuro(v)}` : METHOD[k])).join(' · ');
  const closedAt = detail.closed_at ? time(detail.closed_at) : '';

  const run = async (action) => {
    setBusy(true);
    try { await action(); } catch (err) { showToast(err.message, 'error'); }
    finally { setBusy(false); await onChanged(); }
  };
  // Portate ancora da mandare: la prossima è quella con l'ordine d'uscita più basso (le «insieme» escono tutte)
  const scheduled = activeOrders.filter(o => o.status === 'scheduled').sort((a, b) => a.course_seq - b.course_seq || a.id - b.id);
  const next = scheduled.filter(o => o.course_seq === scheduled[0]?.course_seq);
  const fireNext = () => run(async () => {
    const res = await fetchWithAuth(`/checks/${detail.id}/fire`, { method: 'POST', body: {} });
    await printFired(res.orders, res.fired, detail, service, showToast);
    showToast('Portata mandata in cucina', 'success');
  });
  // Chiudere un conto già saldato libera il tavolo: il pannello torna alla sala
  const closeCheck = async () => {
    setBusy(true);
    try {
      await fetchWithAuth(`/checks/${detail.id}/close`, { method: 'POST', body: {} });
      showToast('Conto chiuso', 'success');
      onDeleted();
    } catch (err) { showToast(err.message, 'error'); await onChanged(); }
    finally { setBusy(false); }
  };
  const deleteCheck = async () => {
    setBusy(true);
    try {
      await fetchWithAuth(`/checks/${detail.id}/void`, { method: 'POST', body: { cancel_orders: realOrders.length > 0 } });
      showToast('Conto eliminato', 'info');
      onDeleted();
    } catch (err) { showToast(err.message, 'error'); await onChanged(); }
    finally { setBusy(false); }
  };

  const menu = open && [
    { label: billRequested ? 'Annulla richiesta conto' : 'Il cliente chiede il conto', icon: billRequested ? BellOff : BellRing,
      onClick: () => run(() => fetchWithAuth(`/checks/${detail.id}/bill-request`, { method: 'POST', body: { requested: !detail.bill_requested_at } })) },
    { label: 'Stampa il conto', icon: Printer, onClick: () => onPrint() },
    ...(detail.payments.length > 1 ? detail.payments.map(p => ({ label: `Ricevuta ${METHOD[p.method]} ${formatEuro(p.amount)}`, icon: Printer, onClick: () => onPrint(p.id) })) : []),
    { label: 'Modifica i coperti', icon: Users, onClick: onCovers },
    { label: 'Sposta o unisci tavolo', icon: ArrowRightLeft, onClick: onMove },
    canDiscount && activeOrders.length > 0 && { label: 'Omaggio o sconto', icon: Percent, onClick: onAdjust },
    (user.role === 'admin' || (canDiscount && realOrders.length === 0)) && { label: 'Elimina conto', icon: Trash2, danger: true, disabled: hasPayments, hint: 'Ci sono già pagamenti', onClick: () => setConfirmDelete(true) },
  ];

  const subtitle = billRequested ? `Conto richiesto · ${detail.covers} cop.` : `${{ open: 'Aperto', paid: 'Pagato', void: 'Annullato' }[detail.status]} · ${detail.covers} cop. · n. ${detail.number}`;
  const subtitleClass = billRequested ? 'text-amber-500' : open ? 'text-green-500' : 'text-[var(--text-muted)]';

  return (
    <PanelFrame title={detail.table_name ?? 'Banco'} subtitle={subtitle} subtitleClass={subtitleClass} onBack={onBack}
      actions={menu && <ActionMenu items={menu} />}
      footer={
        <>
          <div className="space-y-0.5">
            {hasPayments && open && <div className="flex justify-between text-xs text-[var(--text-muted)]"><span>Totale {formatEuro(detail.total)}</span><span>Già pagato {formatEuro(detail.paid)}{methods && ` · ${methods}`}</span></div>}
            <div className="flex justify-between items-baseline">
              <span className={label}>{open ? 'Da pagare' : 'Totale'}</span>
              <span className="text-3xl font-semibold tabular-nums text-[var(--text-main)]">{formatEuro(open ? detail.due : detail.total)}</span>
            </div>
            {hasPayments && !open && <p className="text-sm text-[var(--text-muted)] text-right">Pagato {methods}{closedAt && ` · ${closedAt}`}</p>}
          </div>
          {open ? (
            <div className="grid grid-cols-2 gap-2">
              <button className={cash ? btn : btnPrimary} disabled={busy || !service} title={service ? undefined : 'Il servizio è chiuso'} onClick={onOrder}><Plus size={16} /> Aggiungi</button>
              {cash ? (detail.due > 0
                ? <button className={btnPrimary} disabled={busy} onClick={onPay}><Wallet size={16} /> Incassa</button>
                : <button className={btnPrimary} disabled={busy || !activeOrders.length} onClick={closeCheck}><Lock size={16} /> Chiudi</button>)
                // Il cameriere non incassa: chiede il conto alla cassa
                : <button className={btn} disabled={busy} onClick={() => run(() => fetchWithAuth(`/checks/${detail.id}/bill-request`, { method: 'POST', body: { requested: !detail.bill_requested_at } }))}>
                  {billRequested ? <BellOff size={16} /> : <BellRing size={16} />} {billRequested ? 'Annulla conto' : 'Chiedi il conto'}</button>}
            </div>
          ) : <button className={`${btn} w-full`} onClick={() => onPrint()}><Printer size={16} /> Stampa ricevuta</button>}
        </>
      }>
      {confirmDelete && (
        <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/5 space-y-2">
          <p className="text-xs text-[var(--text-main)]">
            {realOrders.length > 0 ? `Elimina il conto e annulla ${realOrders.length} ${realOrders.length === 1 ? 'comanda' : 'comande'}: i prodotti tornano disponibili.` : 'Annulla il conto vuoto: il tavolo torna libero.'}
          </p>
          <div className="flex gap-2">
            <button className={`${btn} flex-1 !py-2`} onClick={() => setConfirmDelete(false)}>No</button>
            <button className={`${btnDanger} flex-1 !py-2`} disabled={busy} onClick={deleteCheck}>Sì, elimina</button>
          </div>
        </div>
      )}
      {open && next.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/5">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--text-muted)]">Prossima portata</p>
            <p className="text-sm font-semibold text-[var(--text-main)] truncate">{next.map(o => o.course_name ?? NO_COURSE_NAME).join(' + ')}</p>
          </div>
          <button className={`${btnPrimary} !h-10`} disabled={busy} onClick={fireNext}><Send size={15} /> Manda</button>
        </div>
      )}
      <CheckOrders detail={detail} user={user} onChanged={onChanged} />
    </PanelFrame>
  );
};

export default CheckView;
