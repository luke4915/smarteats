import { useEffect, useState, useMemo } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { ChefHat, Download, QrCode, Maximize2 } from 'lucide-react';

import { apiFetch } from '../utils/apiClient';
import { PublicShell } from '../components/public/PublicShell';
import { CategoryChips, ProductRows } from '../components/public/MenuList';
import Modal from '../components/shared/Modal';
import ModalActions from '../components/shared/ModalActions';
import { useSystemTheme } from '../hooks/useSystemTheme';
import { btn, btnPrimary, btnDanger } from '../smarteats/floor/ui';
import { formatEuro } from '../utils/format';
import Loading from '../components/shared/Loading';
import SearchField from '../components/shared/SearchField';

// Il menu pubblico della sagra (`/menu`, dal QR): il cliente sceglie i prodotti e mostra alla cassa un QR con id e quantità. Non è un
// ordine: la cassa lo legge e ricalcola prezzi e disponibilità dal proprio catalogo. Stessa grafica dell'ordine da asporto.

// Le righe dell'ordine e il totale, nella finestra del QR.
const Summary = ({ lines, total }) => (
  <div>
    <ul className="space-y-1.5">
      {lines.map(line => (
        <li key={line.id} className="flex justify-between text-sm">
          <span className="font-medium">×{line.quantity} {line.name}</span>
          <span className="text-[var(--text-muted)] tabular-nums">{formatEuro(parseFloat(line.price) * line.quantity)}</span>
        </li>
      ))}
    </ul>
    <div className="flex justify-between font-semibold border-t border-[var(--border)] pt-3 mt-3"><span>Totale</span><span className="tabular-nums">{formatEuro(total)}</span></div>
  </div>
);

export default function MenuPage() {
  useSystemTheme();
  const [menu, setMenu] = useState(null);
  const [welcome, setWelcome] = useState('');
  const [error, setError] = useState('');
  const [cart, setCart] = useState({});            // { [id prodotto]: quantità }
  const [category, setCategory] = useState(null);
  const [sheet, setSheet] = useState(null);        // 'qr' | 'big' | null
  const [clearing, setClearing] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    // Il messaggio di benvenuto è facoltativo: se non arriva il menu si mostra comunque.
    Promise.all([apiFetch('/products/menu'), apiFetch('/settings').catch(() => ({}))])
      .then(([data, settings]) => { setMenu(data); setWelcome(settings.welcome_message || ''); })
      .catch(() => setError('Menu non disponibile al momento.'));
  }, []);

  const categories = useMemo(() => [...new Set((menu?.products ?? []).map(p => p.category))], [menu]);
  const shownCategory = category ?? categories[0];
  const term = query.trim().toLowerCase();
  const lines = useMemo(() => (menu?.products ?? []).filter(p => cart[p.id]).map(p => ({ ...p, quantity: cart[p.id] })), [menu, cart]);
  const total = lines.reduce((sum, l) => sum + parseFloat(l.price) * l.quantity, 0);
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);
  // Solo id e quantità: la cassa legge il resto dal proprio catalogo
  const qrData = useMemo(() => (lines.length ? btoa(JSON.stringify(lines.map(l => ({ id: l.id, quantity: l.quantity })))) : ''), [lines]);

  const change = (id, delta) => setCart(prev => {
    const quantity = (prev[id] ?? 0) + delta;
    const next = { ...prev };
    if (quantity > 0) next[id] = quantity; else delete next[id];
    return next;
  });
  const closeSheet = () => { setSheet(null); setClearing(false); };
  const clear = () => { setCart({}); closeSheet(); };
  const downloadQr = () => {
    const link = document.createElement('a');
    link.href = document.getElementById('qr-canvas')?.toDataURL('image/png') ?? '';
    link.download = 'ordine-qr.png';
    link.click();
  };

  if (error) {
    return (
      <PublicShell>
        <div className="flex flex-col items-center gap-4 py-20"><ChefHat size={48} className="text-[var(--text-muted)] opacity-30" /><p className="text-sm text-[var(--text-muted)] text-center" role="alert">{error}</p></div>
      </PublicShell>
    );
  }
  if (!menu) return <PublicShell><Loading /></PublicShell>;

  const bar = count > 0 && (
    <div className="sticky bottom-0 -mx-4 px-4 pt-3 bg-[var(--bg-main)] border-t border-[var(--border)]" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <button className={`${btnPrimary} w-full !h-12 !text-base justify-between`} onClick={() => setSheet('qr')}>
        <span className="flex items-center gap-2"><QrCode size={18} /> {count} {count === 1 ? 'articolo' : 'articoli'}</span><span>Mostra il QR · {formatEuro(total)}</span>
      </button>
    </div>
  );

  return (
    <PublicShell info={{ name: menu.tenantName ?? 'Menu', welcome }} kicker={menu.sessionName ? `Menu · ${menu.sessionName}` : 'Menu'} footer={bar}>
      {menu.products.length > 8 && <SearchField value={query} onChange={setQuery} placeholder="Cerca un prodotto" />}
      {categories.length > 1 && !term && <CategoryChips categories={categories} value={shownCategory} onChange={setCategory} />}
      <ProductRows products={term ? menu.products.filter(p => p.name.toLowerCase().includes(term)) : menu.products.filter(p => categories.length < 2 || p.category === shownCategory)} quantities={cart} onChange={change} />
      {term && !menu.products.some(p => p.name.toLowerCase().includes(term)) && <p className="text-sm text-[var(--text-muted)] text-center py-8">Nessun prodotto con «{query.trim()}».</p>}
      {menu.products.length === 0 && <p className="text-sm text-[var(--text-muted)] text-center py-8">Al momento non ci sono prodotti da scegliere.</p>}

      {sheet === 'qr' && (
        <Modal title="Il tuo ordine" onClose={closeSheet}
          footer={(
            <ModalActions cancelLabel="Chiudi" onCancel={closeSheet}
              start={<button type="button" className={btnDanger} onClick={() => (clearing ? clear() : setClearing(true))}>{clearing ? 'Sì, svuota' : 'Svuota'}</button>} />
          )}>
          <div className="space-y-5">
            <Summary lines={lines} total={total} />
            <div className="flex flex-col items-center gap-3">
              <button onClick={() => setSheet('big')} className="p-4 bg-white rounded-xl cursor-pointer" aria-label="Ingrandisci il codice QR"><QRCodeCanvas id="qr-canvas" value={qrData} size={200} /></button>
              <p className="text-xs text-[var(--text-muted)] text-center">Mostra questo QR alla cassa</p>
              <div className="flex gap-2">
                <button onClick={() => setSheet('big')} className={btn}><Maximize2 size={16} /> Ingrandisci</button>
                <button onClick={downloadQr} className={btn}><Download size={16} /> Salva</button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {sheet === 'big' && (
        <Modal onClose={() => setSheet('qr')} footer={<ModalActions fill cancelLabel="Indietro" onCancel={() => setSheet('qr')} />}>
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="p-5 bg-white rounded-2xl"><QRCodeCanvas value={qrData} size={260} /></div>
            <p className="text-sm text-[var(--text-muted)]">Mostralo direttamente in cassa.</p>
          </div>
        </Modal>
      )}
    </PublicShell>
  );
}
