import { useState, useMemo } from 'react';
import { Banknote, Coins, Check, Minus, Plus } from 'lucide-react';
import Modal from './Modal';
import ModalActions from './ModalActions';
import { btnPrimary } from '../../smarteats/floor/ui';

const NOTES = [100, 50, 20, 10, 5];
const COINS = [2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01];

const DenomTile = ({ value, qty, onChange }) => {
  const label = value >= 1 ? `${value} €` : `${Math.round(value * 100)} c`;
  const subtotal = value * (qty || 0);

  return (
    <div className="flex items-center gap-3 p-3 bg-[var(--bg-card-2)] rounded-xl border border-[var(--border)]">
      <img
        src={`/cash/${value}.png`}
        alt={label}
        className="w-14 h-14 object-contain shrink-0"
        onError={(e) => { e.target.style.visibility = 'hidden'; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[var(--text-main)]">{label}</p>
        <p className="text-xs font-bold text-[var(--text-muted)]">{subtotal.toFixed(2)} €</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, (qty || 0) - 1))}
          className="w-8 h-8 rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition-all cursor-pointer"
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min="0"
          inputMode="numeric"
          value={qty || ''}
          onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
          placeholder="0"
          className="w-12 h-8 rounded-xl bg-[var(--bg-input)] border border-[var(--border)] text-[var(--text-main)] text-sm font-semibold text-center outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button
          type="button"
          onClick={() => onChange((qty || 0) + 1)}
          className="w-8 h-8 rounded-xl border border-[var(--border)] flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-card)] transition-all cursor-pointer"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
};

const CashCountModal = ({ expectedCash = 0, onConfirm, onClose }) => {
  const [counts, setCounts] = useState({});

  const setQty = (value, qty) => setCounts(prev => ({ ...prev, [value]: qty }));

  const total = useMemo(
    () => Object.entries(counts).reduce((sum, [value, qty]) => sum + parseFloat(value) * (qty || 0), 0),
    [counts]
  );

  const difference = +(total - expectedCash).toFixed(2);
  const diffColor = difference === 0 ? 'text-green-500' : Math.abs(difference) < 1 ? 'text-orange-500' : 'text-red-500';

  return (
    <Modal title="Conteggio cassa" size="max-w-2xl" onClose={onClose}
      footer={(
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-[var(--text-muted)]"><span>Atteso da sistema</span><span className="tabular-nums">{expectedCash.toFixed(2)} €</span></div>
          <div className="flex justify-between text-base font-semibold text-[var(--text-main)]"><span>Contato</span><span className="tabular-nums">{total.toFixed(2)} €</span></div>
          <div className={`flex justify-between text-base font-semibold ${diffColor}`}><span>Differenza</span><span className="tabular-nums">{difference > 0 ? '+' : ''}{difference.toFixed(2)} €</span></div>
          <div className="!mt-3"><ModalActions fill onCancel={onClose}><button type="button" onClick={() => onConfirm(total)} className={btnPrimary}><Check size={18} /> Conferma chiusura</button></ModalActions></div>
        </div>
      )}>
      <p className="text-sm text-[var(--text-muted)] mb-4">Conta i contanti a taglio.</p>
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-2"><Banknote size={13} /> Banconote</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-6">
        {NOTES.map(v => <DenomTile key={v} value={v} qty={counts[v]} onChange={(q) => setQty(v, q)} />)}
      </div>
      <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--text-muted)] mb-2"><Coins size={13} /> Monete</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {COINS.map(v => <DenomTile key={v} value={v} qty={counts[v]} onChange={(q) => setQty(v, q)} />)}
      </div>
    </Modal>
  );
};

export default CashCountModal;
