import React from 'react';
import { ShoppingCart, Check, Printer, MessageSquare, QrCode, Trash2, ShoppingBag, ChevronLeft, Minus, Plus, Undo2 } from 'lucide-react';
import { getLineTotal, getAdjustmentLabel } from '../../../utils/pricing';
import OrderDiscountPanel from '../OrderDiscountPanel';
import ActionMenu from '../../shared/ActionMenu';
import { formatEuro } from '../../../utils/format';
import QuickCash from '../QuickCash';

// Il carrello da telefono, a tutto schermo. Dall'alto: intestazione con «indietro» e le azioni, le righe (con più e
// meno direttamente sulla riga; un tocco sul nome apre nota e sconto), poi in basso, alla portata del pollice: totale,
// contanti ricevuti e resto, e «Invia ordine». La logica è quella di sempre (Cart.jsx): qui cambia solo la disposizione.
const CartMobileView = ({
    onClose,
    cart,
    mergedCart,
    cartKey,
    total,
    fullTotal,
    hasAnyDiscount,
    amountReceived,
    setAmountReceived,
    change,
    sessionActive,
    handleSendOrder,
    sending,
    setSelectedItem,
    setIsQRScanModalOpen,
    setIsReprintModalOpen,
    setIsClearModalOpen,
    setShowReversePopup,
    applyOrderDiscount,
    canDiscount,
    isAllGift,
    derivedOrderPercent,
    isTakeaway,
    setIsTakeaway,
    addToCart,
    removeLastItem
}) => {

    const pieces = cart.reduce((s, i) => s + i.quantity, 0);

    const iconBtn = 'h-11 w-11 shrink-0 flex items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-muted)] active:scale-95 transition disabled:opacity-40';

    return (
        <div className="flex flex-col h-full bg-[var(--bg-card)] text-[var(--text-main)] overflow-hidden">

            {/* ─── Intestazione ─── */}
            <div className="px-2 py-2 flex items-center gap-1 border-b border-[var(--border)] shrink-0">
                <button onClick={onClose} aria-label="Torna ai prodotti" className="h-11 w-11 flex items-center justify-center rounded-lg text-[var(--text-main)] active:bg-[var(--bg-card-2)]">
                    <ChevronLeft size={24} />
                </button>
                <div className="min-w-0 flex-1">
                    <h2 className="text-base font-semibold leading-tight">Ordine</h2>
                    <p className={`text-xs ${sessionActive ? 'text-green-500' : 'text-red-400'}`}>
                        {pieces} {pieces === 1 ? 'articolo' : 'articoli'}{!sessionActive && ' · serata non aperta'}
                    </p>
                </div>

                <button onClick={() => setIsTakeaway(v => !v)} aria-pressed={isTakeaway} title={isTakeaway ? 'Asporto attivo' : 'Segna come asporto'}
                    className={`${iconBtn} ${isTakeaway ? '!bg-green-500 !border-green-500 !text-white' : ''}`}>
                    <ShoppingBag size={20} />
                </button>
                {canDiscount && (
                    <OrderDiscountPanel cart={cart} derivedOrderPercent={derivedOrderPercent} applyOrderDiscount={applyOrderDiscount}
                        buttonClassName="p-3 min-w-[44px] min-h-[44px] flex items-center justify-center" />
                )}
                <ActionMenu items={[
                    { label: 'Storno ordini', icon: Undo2, onClick: () => setShowReversePopup(true), disabled: !sessionActive, hint: 'Serve una serata aperta' },
                    { label: 'Importa ordine da QR', icon: QrCode, onClick: () => setIsQRScanModalOpen(true) },
                    { label: 'Ristampa scontrini recenti', icon: Printer, onClick: () => setIsReprintModalOpen(true), disabled: !sessionActive, hint: 'Serve una serata aperta' },
                ]} />
            </div>

            {/* ─── Righe ─── */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 no-scrollbar">
                {mergedCart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-40">
                        <ShoppingCart size={44} />
                        <p className="text-sm mt-3">Il carrello è vuoto</p>
                    </div>
                ) : (
                    mergedCart.map(item => {
                        const adjLabel = getAdjustmentLabel(item);
                        const effTotal = getLineTotal(item);
                        return (
                            <div key={cartKey(item)} className="rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)] p-2.5 flex items-center gap-2 select-none">
                                <button onClick={() => setSelectedItem(item)} className="min-w-0 flex-1 text-left py-1 pl-1 cursor-pointer" aria-label={`Modifica ${item.name}`}>
                                    <span className="flex items-center gap-2 min-w-0">
                                        <span className="font-medium text-sm leading-snug truncate">{item.name}</span>
                                        {adjLabel && <span className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${item.type === 'gift' ? 'bg-purple-500/10 text-purple-500' : 'bg-orange-500/10 text-orange-500'}`}>{adjLabel}</span>}
                                    </span>
                                    {item.note && (
                                        <span className="mt-1 flex items-center gap-1.5 text-xs text-yellow-500 min-w-0">
                                            <MessageSquare size={12} className="shrink-0" /><span className="truncate">{item.note}</span>
                                        </span>
                                    )}
                                    <span className="mt-0.5 block text-xs tabular-nums text-[var(--text-muted)]">
                                        {adjLabel
                                            ? <><span className="line-through">{formatEuro(item.price * item.quantity)}</span> <span className={item.type === 'gift' ? 'text-purple-500' : 'text-orange-500'}>{formatEuro(effTotal)}</span></>
                                            : `${formatEuro(item.price)} l'uno`}
                                    </span>
                                </button>

                                {/* Più e meno direttamente sulla riga */}
                                <div className="flex items-center shrink-0">
                                    <button onClick={() => removeLastItem(item)} aria-label={`Una in meno: ${item.name}`}
                                        className="h-10 w-10 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] active:scale-90 transition">
                                        {item.quantity === 1 ? <Trash2 size={16} className="text-red-500" /> : <Minus size={16} />}
                                    </button>
                                    <span className="w-8 text-center text-base font-semibold tabular-nums">{item.quantity}</span>
                                    <button onClick={() => addToCart(item)} aria-label={`Una in più: ${item.name}`}
                                        className="h-10 w-10 flex items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] active:scale-90 transition">
                                        <Plus size={16} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* ─── Pagamento, alla portata del pollice ─── */}
            <div className="border-t border-[var(--border)] bg-[var(--bg-card-2)] px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] space-y-3 shrink-0">

                {/* Totale */}
                <div className="flex items-end justify-between px-1">
                    <div>
                        <span className="text-sm text-[var(--text-muted)]">Totale</span>
                        {isAllGift && <span className="ml-2 text-xs font-semibold bg-purple-500/10 text-purple-500 px-2 py-0.5 rounded-full">Omaggio</span>}
                        {!isAllGift && hasAnyDiscount && <span className="ml-2 text-xs font-semibold bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-full">Scontato</span>}
                    </div>
                    {hasAnyDiscount ? (
                        <div className="flex items-baseline gap-2">
                            <span className="text-sm line-through text-[var(--text-muted)] tabular-nums">{formatEuro(fullTotal)}</span>
                            <span className={`text-3xl font-semibold tabular-nums ${isAllGift ? 'text-purple-500' : 'text-orange-500'}`}>{formatEuro(total)}</span>
                        </div>
                    ) : (
                        <span className="text-3xl font-semibold tabular-nums text-[var(--text-main)]">{formatEuro(total)}</span>
                    )}
                </div>

                {/* Contanti: ricevuti e resto */}
                <div className="grid grid-cols-2 gap-2">
                    <label className="bg-[var(--bg-card)] px-3 py-1.5 rounded-lg border border-[var(--border)] flex flex-col">
                        <span className="text-xs text-[var(--text-muted)]">Ricevuti</span>
                        <input type="text" inputMode="decimal" value={amountReceived.replace('.', ',')} placeholder="0,00"
                            onChange={e => { const val = e.target.value.replace(',', '.'); if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) setAmountReceived(val); }}
                            className="w-full bg-transparent outline-none text-lg font-semibold tabular-nums text-[var(--text-main)]" />
                    </label>
                    <div className="bg-[var(--bg-card)] px-3 py-1.5 rounded-lg border border-[var(--border)] flex flex-col">
                        <span className="text-xs text-[var(--text-muted)]">Resto</span>
                        {amountReceived === ''
                            ? <span className="text-lg font-semibold tabular-nums text-[var(--text-muted)]">—</span>
                            : <span className={`text-lg font-semibold tabular-nums ${change < 0 ? 'text-red-500' : 'text-green-500'}`}>{change >= 0 ? formatEuro(change) : `mancano ${formatEuro(Math.abs(change))}`}</span>}
                    </div>
                </div>
                <QuickCash total={total} received={amountReceived} onChange={setAmountReceived} disabled={cart.length === 0} />

                <button onClick={handleSendOrder} disabled={cart.length === 0 || !sessionActive || sending}
                    className="w-full h-14 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--bg-input)] disabled:text-[var(--text-muted)] text-white rounded-xl font-semibold text-base active:scale-[0.98] transition flex items-center justify-center gap-2.5">
                    <Check size={20} /> {sending ? 'Invio…' : 'Invia ordine'}
                </button>

                <button onClick={() => cart.length > 0 && setIsClearModalOpen(true)} disabled={cart.length === 0}
                    className="w-full h-10 border border-red-500/30 text-red-500 rounded-lg text-sm font-medium transition disabled:opacity-30 flex items-center justify-center gap-1.5 active:bg-red-500/10">
                    <Trash2 size={14} /> Svuota
                </button>
            </div>

        </div>
    );
};

export default CartMobileView;
