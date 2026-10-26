import { useState } from 'react';
import { Check } from 'lucide-react';
import { fetchWithAuth } from '../../../utils/apiClient';
import { useToast } from '../../../context/useToast';
import Modal from '../../shared/Modal';
import ModalActions from '../../shared/ModalActions';
import Switch from '../../shared/Switch';
import { btnPrimary, input, label } from '../../../smarteats/floor/ui';

const QuickEditProductModal = ({ product, onClose, onSaved }) => {
  const { showToast } = useToast();
  const [price, setPrice] = useState(
    product?.price !== undefined && product?.price !== null ? String(product.price) : ''
  );
  const [stockEnabled, setStockEnabled] = useState(product?.stock_enabled ?? false);
  const [stock, setStock] = useState(
    product?.stock !== undefined && product?.stock !== null ? String(product.stock) : ''
  );
  const [saving, setSaving] = useState(false);

  if (!product) return null;

  const handlePriceChange = (e) => {
    const val = e.target.value.replace(',', '.');
    // Limita a max 2 cifre decimali dopo il punto
    if (/^\d*\.?\d{0,2}$/.test(val)) {
      setPrice(val);
    }
  };

  const handleSave = async () => {
    // Validazione disponibilità limitata
    if (stockEnabled) {
      const parsedStock = parseInt(stock, 10);
      if (stock === '' || isNaN(parsedStock) || parsedStock < 0) {
        showToast('Inserisci una quantità valida per la disponibilità limitata', 'error');
        return;
      }
    }

    setSaving(true);
    try {
      const parsedPrice = parseFloat(String(price).replace(',', '.')) || 0;
      
      // 1. Aggiornamento Prodotto (Prezzo)
      const updated = await fetchWithAuth(`/products/${product.id}`, {
        method: 'PUT',
        body: { ...product, price: parsedPrice },
      });

      // 2. Aggiornamento Stock: se fallisce il prezzo resta salvato, lo si segnala a parte
      const stockData = await fetchWithAuth(`/products/${product.id}/stock`, {
        method: 'PATCH',
        body: { stock: stockEnabled ? parseInt(stock, 10) : null, stock_enabled: !!stockEnabled },
      }).catch(err => {
        showToast(`Prezzo aggiornato, ma errore nella gestione dello stock: ${err.message}`, 'error');
        return {};
      });

      // Notifica di successo e chiusura
      showToast(`Prodotto "${product.name}" aggiornato con successo`, 'success');
      onSaved({
        ...updated,
        price: parseFloat(updated.price),
        stock: stockData.stock ?? null,
        stock_enabled: !!stockData.stock_enabled
      });
      onClose();
    } catch (err) {
      console.error("Errore modifica rapida prodotto:", err);
      showToast(err.message || "Impossibile salvare le modifiche al prodotto", 'error');
      setSaving(false);
    }
  };

  const isSaveDisabled = saving || (stockEnabled && (stock === '' || isNaN(parseInt(stock, 10)) || parseInt(stock, 10) < 0));

  return (
    <Modal title={product.name} onClose={onClose}
      footer={(
        <ModalActions fill onCancel={onClose}>
          <button type="button" onClick={handleSave} disabled={isSaveDisabled} className={btnPrimary}><Check size={16} /> {saving ? 'Salvataggio...' : 'Salva'}</button>
        </ModalActions>
      )}>
      <label htmlFor="qe_price" className={`${label} block mb-1.5`}>Prezzo</label>
      <input id="qe_price" type="text" inputMode="decimal" value={price} onChange={handlePriceChange} placeholder="Prezzo (es. 8.50 o 8,50)" className={`${input} mb-4`} />

      <div className="p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border)] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="qe_stock_enabled" className="text-sm font-medium text-[var(--text-main)]">Disponibilità limitata</label>
          <Switch checked={stockEnabled} onChange={setStockEnabled} label="Disponibilità limitata" />
        </div>
        {stockEnabled && (
          <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Quantità disponibile" aria-label="Quantità disponibile" className={input} />
        )}
      </div>
    </Modal>
  );
};

export default QuickEditProductModal;
