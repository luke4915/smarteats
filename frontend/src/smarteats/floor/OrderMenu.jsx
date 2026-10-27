import { ChevronLeft } from 'lucide-react';
import ProductPicker from '../../components/shared/ProductPicker';

// La carta per fare una comanda al tavolo: il titolo con il ritorno alla Sala e la carta comune (`ProductPicker`).
const OrderMenu = ({ products, cart, tableName, onAdd, onBack }) => (
  <div className="flex flex-col h-full">
    <div className="flex items-center gap-3 pb-3 shrink-0">
      <button onClick={onBack} className="flex items-center gap-1 pr-3 py-1.5 text-[var(--text-muted)] hover:text-[var(--text-main)] text-xs font-semibold"><ChevronLeft size={18} /> Sala</button>
      <h2 className="text-xl font-semibold text-[var(--text-main)] truncate">Carta · {tableName}</h2>
    </div>
    <ProductPicker products={products} cart={cart} onAdd={onAdd} />
  </div>
);

export default OrderMenu;
