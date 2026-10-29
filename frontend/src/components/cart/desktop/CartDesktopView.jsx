import React from 'react';
import { ShoppingCart, Printer, MessageSquare, QrCode, ShoppingBag, Undo2, Send, Trash } from 'lucide-react';
import { getLineTotal, getAdjustmentLabel } from '../../../utils/pricing';
import OrderDiscountPanel from '../OrderDiscountPanel';
import ActionMenu from '../../shared/ActionMenu';
import { iconBtn, btnPrimary, btnDanger } from '../../../smarteats/floor/ui';
import { formatEuro } from '../../../utils/format';
import QuickCash from '../QuickCash';

const CartDesktopView = ({
    // Props passate dal Container padre
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
    setShowReversePopup,
    setIsClearModalOpen,
    applyOrderDiscount,
    canDiscount,
    isAllGift,
    derivedOrderPercent,
    isTakeaway,
    setIsTakeaway,
}) => {
    return (
        <div className="flex flex-col h-full bg-[var(--bg-card)] rounded-xl border border-[var(--border)] overflow-hidden">

            {/* Intestazione: Asporto e Sconto subito, il resto nel menu «⋯» */}
            <div className="px-4 py-3 flex justify-between items-center border-b border-[var(--border)]">
                <h2 className="text-xl font-semibold text-[var(--text-main)]">Carrello</h2>
                <div className="flex items-center gap-1.5">
                    <button
                        disabled={cart.length === 0}
                        onClick={() => setIsTakeaway(v => !v)}
                        aria-pressed={isTakeaway}
                        title={isTakeaway ? 'Disattiva asporto' : 'Segna come asporto'}
                        className={`${iconBtn} ${isTakeaway ? '!bg-green-500 !text-white' : ''}`}>
                        <ShoppingBag size={20} />
                    </button>
                    {canDiscount && (
                        <OrderDiscountPanel cart={cart} derivedOrderPercent={derivedOrderPercent} applyOrderDiscount={applyOrderDiscount} />
                    )}
                    <ActionMenu items={[
                        { label: 'Storno ordini', icon: Undo2, onClick: () => setShowReversePopup(true), disabled: !sessionActive, hint: 'Serve una serata aperta' },
                        { label: 'Importa ordine da QR', icon: QrCode, onClick: () => setIsQRScanModalOpen(true) },
                        { label: 'Ristampa scontrini recenti', icon: Printer, onClick: () => setIsReprintModalOpen(true), disabled: !sessionActive, hint: 'Serve una serata aperta' },
                    ]} />
                </div>
            </div>

            {/* Lista articoli */}
            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 no-scrollbar">
                {mergedCart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-[var(--text-muted)] opacity-30">
                        <ShoppingCart size={32} />
                        <p className="text-sm text-center font-semibold mt-2">Vuoto</p>
                    </div>
                ) : mergedCart.map(item => {
                    const adjLabel = getAdjustmentLabel(item);
                    const effTotal = getLineTotal(item);
                    return (
                        <div key={cartKey(item)} onClick={() => setSelectedItem(item)}
                            className="px-3 py-2.5 rounded-lg cursor-pointer border border-[var(--border)] bg-[var(--bg-card-2)] hover:border-[var(--border-hover)] active:scale-[0.99] transition">
                            <div className="flex justify-between items-center gap-2">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <span className="bg-[var(--accent)] text-white text-xs font-semibold min-w-6 h-6 px-1 flex items-center justify-center rounded-md tabular-nums shrink-0">{item.quantity}</span>
                                    <span className="font-medium text-sm text-[var(--text-main)] leading-tight truncate">{item.name}</span>
                                    {adjLabel && (
                                        <span className={`shrink-0 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${item.type === 'gift' ? 'bg-purple-500/10 text-purple-500' : 'bg-orange-500/10 text-orange-500'}`}>{adjLabel}</span>
                                    )}
                                </div>
                                {adjLabel ? (
                                    <span className="flex items-baseline gap-1.5 shrink-0">
                                        <span className="text-xs tabular-nums text-[var(--text-muted)] line-through">{formatEuro(item.price * item.quantity)}</span>
                                        <span className={`font-medium text-sm tabular-nums ${item.type === 'gift' ? 'text-purple-500' : 'text-orange-500'}`}>{formatEuro(effTotal)}</span>
                                    </span>
                                ) : (
                                    <span className="font-medium text-sm tabular-nums text-[var(--text-main)] shrink-0">{formatEuro(item.price * item.quantity)}</span>
                                )}
                            </div>
                            {item.note && (
                                <div className="ml-8 mt-1.5 flex items-center gap-1.5 text-yellow-500 min-w-0">
                                    <MessageSquare size={12} className="shrink-0" />
                                    <span className="text-xs truncate">{item.note}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Footer Cassa Desktop */}
            <div className="px-4 py-3 border-t border-[var(--border)] space-y-2 bg-[var(--bg-card-2)]">
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[var(--bg-card)] px-3 py-1 rounded-lg border border-[var(--border)]">
                        <span className="text-xs text-[var(--text-muted)] block">Ricevuti</span>
                        <div className="flex items-center justify-end w-full gap-1 font-semibold text-xl text-[var(--text-main)] tabular-nums">
                            <input
                                type="text"
                                inputMode="decimal"
                                value={amountReceived.replace('.', ',')}
                                onChange={e => {
                                    const val = e.target.value.replace(',', '.');
                                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                                        setAmountReceived(val);
                                    }
                                }}
                                placeholder="0,00"
                                className="w-full bg-transparent outline-none text-right"
                            />
                            {/* L'euro cambia colore dinamicamente in base a amountReceived */}
                            <span className={`shrink-0 select-none transition-colors duration-150 ${amountReceived ? 'text-[var(--text-main)]' : 'text-[var(--text-muted)]'
                                }`}>
                                €
                            </span>
                        </div>
                    </div>
                    <div className="bg-[var(--bg-card)] px-3 py-1 rounded-lg border border-[var(--border)]">
                        <span className="text-xs text-[var(--text-muted)] block">Resto</span>
                        <span className={`text-xl font-semibold tabular-nums block text-right transition-colors duration-150 ${!amountReceived
                            ? 'text-[var(--text-muted)]'
                            : change < 0
                                ? 'text-red-500'
                                : 'text-green-500'
                            }`}>
                            {formatEuro(Math.max(0, change))}
                        </span>
                    </div>
                </div>

                <QuickCash total={total} received={amountReceived} onChange={setAmountReceived} disabled={cart.length === 0} />

                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-semibold text-[var(--text-main)]">Totale</span>
                        {isAllGift && <span className="text-[11px] font-semibold bg-purple-500/10 text-purple-500 border border-purple-500/30 px-2 py-0.5 rounded-full">Omaggio</span>}
                        {!isAllGift && hasAnyDiscount && <span className="text-[11px] font-semibold bg-orange-500/10 text-orange-500 border border-orange-500/30 px-2 py-0.5 rounded-full">Scontato</span>}
                    </div>
                    {hasAnyDiscount ? (
                        <div className="flex items-baseline gap-2">
                            <span className="text-base font-semibold line-through text-[var(--text-muted)] tabular-nums">{formatEuro(fullTotal)}</span>
                            <span className={`text-2xl font-semibold tabular-nums ${isAllGift ? 'text-purple-500' : 'text-orange-500'}`}>{formatEuro(total)}</span>
                        </div>
                    ) : (
                        <span className="text-2xl font-semibold text-[var(--text-main)] tabular-nums">{formatEuro(total)}</span>
                    )}
                </div>

                <div className="flex gap-2 w-full">
                    <button onClick={handleSendOrder} disabled={cart.length === 0 || !sessionActive || sending} className={`${btnPrimary} flex-1 !h-12 text-base`}>
                        <Send size={18} /> Invia ordine
                    </button>
                    <button onClick={() => cart.length > 0 && setIsClearModalOpen(true)} disabled={cart.length === 0} className={`${btnDanger} !h-12`}>
                        <Trash size={16} /> Svuota
                    </button>
                </div>
            </div>

        </div>
    );
};

export default CartDesktopView;