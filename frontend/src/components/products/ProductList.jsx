import { useState } from 'react';
import ProductPicker from '../shared/ProductPicker';
import QuickEditProductModal from './modals/QuickEditProductModal';

// La carta della cassa delle sagre: la stessa carta di tutta l'app (`ProductPicker`) con il «−» sulle tessere e, tenendo premuto,
// la modifica rapida di prezzo e disponibilità. Su telefono lascia in fondo lo spazio per la barra «Apri la cassa».
const ProductList = ({ products, addToCart, removeLastItem, cart, setProducts }) => {
  const [editing, setEditing] = useState(null);
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <ProductPicker products={products} cart={cart} onAdd={addToCart} lowStockAt={15} scrollPadding="pb-20 md:pb-2"
        onRemove={(product) => removeLastItem?.([...(cart ?? [])].reverse().find(i => i.id === product.id))} onLongPress={setEditing} />
      <QuickEditProductModal key={editing?.id} product={editing} onClose={() => setEditing(null)}
        onSaved={(updated) => setProducts?.(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))} />
    </div>
  );
};

export default ProductList;
