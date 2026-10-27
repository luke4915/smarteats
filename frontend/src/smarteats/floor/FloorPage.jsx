import { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useToast } from '../../context/useToast';
import { useIsMobile } from '../../hooks/useBreakpoint';
import FloorView from './FloorView';
import SidePanel from './SidePanel';
import WalkInPanel from '../reservations/WalkInPanel';
import SlidePanel from './SlidePanel';
import { usePanelReserve } from './usePanelReserve';
import OrderMenu from './OrderMenu';
import { useProducts } from './useProducts';
import { useCourses } from './useCourses';
import { useModifiers } from './useModifiers';
import ModifierPicker from './ModifierPicker';
import { courseOfProduct } from './courses';
import { nextByTable, todayLocal } from '../reservations/rules';
import { addToCart, cartTotal } from './checkMath';
import { formatEuro } from '../../utils/format';
import { btnPrimary, card } from './ui';
import Loading from '../../components/shared/Loading';


// La Sala come la cassa: a sinistra l'area di lavoro (i tavoli, oppure la carta quando si fa una comanda), a destra un
// solo pannello che cambia contenuto (apri tavolo, conto, incasso, comanda). Sotto i 1280 px il pannello è a tutto schermo.
const FloorPage = ({ user, service, event }) => {
  const { showToast } = useToast();
  const narrow = useIsMobile(900);          // sotto 900 px (telefono, tablet in verticale) il pannello è a tutto schermo
  const [rooms, setRooms] = useState(null);
  const [checks, setChecks] = useState([]);
  const [reservations, setReservations] = useState([]);   // prenotazioni di oggi (modulo bookings): per segnare i tavoli prenotati
  const [selection, setSelection] = useState(null);   // { table, checkId|null }
  const [walkIn, setWalkIn] = useState(null);         // chi arriva senza prenotazione: { chosen: id del tavolo scelto|null, fits: id dei tavoli adatti, free: id dei tavoli liberi }
  const location = useLocation();
  const navigate = useNavigate();
  const [ordering, setOrdering] = useState(false);
  const [draftOpen, setDraftOpen] = useState(false);  // solo su schermo stretto: la comanda sopra la carta
  const [cart, setCart] = useState([]);
  const products = useProducts(ordering);
  const courses = useCourses();
  const modifiers = useModifiers();
  const reserve = usePanelReserve(!!(selection || walkIn) && !narrow);   // spazio che il pannello toglie all'area di lavoro
  const [picking, setPicking] = useState(null);       // piatto con opzioni da scegliere prima di aggiungerlo

  const load = useCallback(async () => {
    try {
      const withBookings = user.modules?.includes('bookings');
      const [r, c, b] = await Promise.all([fetchWithAuth('/rooms'), fetchWithAuth('/checks?status=open'),
        withBookings ? fetchWithAuth(`/bookings/reservations?date=${todayLocal()}`) : []]);
      setRooms(r); setChecks(c); setReservations(b);
    } catch (err) { showToast(err.message || 'Errore caricamento sala', 'error'); }
  }, [showToast, user.modules]);

  useEffect(() => { load(); }, [load, service?.id]);

  // Si arriva da «Vai al tavolo» delle prenotazioni: si apre quel tavolo, poi lo stato di navigazione si butta
  useEffect(() => {
    const target = location.state;
    if (!rooms || !target?.tableId) return;
    const table = rooms.flatMap(r => r.tables).find(t => t.id === target.tableId);
    if (table) setSelection({ table, checkId: target.checkId ?? null });
    navigate(location.pathname, { replace: true, state: null });
  }, [rooms, location, navigate]);
  // La cucina segna pronta una portata: lo si dice a chi è in sala, così la porta al tavolo (niente da confermare)
  useEffect(() => {
    const o = event?.type === 'order_updated' ? event.order : null;
    // Lo vede solo chi ha in carico il tavolo (ha aperto il conto): gli altri camerieri non vengono disturbati.
    if (o?.status === 'completed' && o.check_id && o.order_type !== 'cover' && o.check_opened_by === user.id)
      showToast(`${o.table_name ? `Tavolo ${o.table_name}` : 'Conto'}: ${o.course_name ?? 'piatti'} pronti`, 'success', 8000);
  }, [event, showToast, user.id]);
  // Un conto cambia su un altro dispositivo
  useEffect(() => { if (event?.type === 'check_updated' || event?.type === 'reservation_updated') load(); }, [event, load]);
  const reserved = nextByTable(reservations);

  const reset = () => { setPicking(null); setOrdering(false); setDraftOpen(false); setCart([]); };
  const close = () => { reset(); setSelection(null); load(); };
  const select = (table, check) => {
    if (walkIn) return pickForWalkIn(table);
    if (!check && !service) return showToast('Apri il servizio per aprire i tavoli', 'warning');
    if (selection?.checkId !== (check?.id ?? null) || selection?.table.id !== table.id) reset();
    setSelection({ table, checkId: check?.id ?? null });
  };
  // Walk-in: un tocco sulla mappa sceglie il tavolo (solo se è libero adesso)
  const pickForWalkIn = (table) => {
    if (!walkIn.free.includes(table.id)) return showToast(`${table.name} non è libero: scegline uno libero`, 'warning');
    setWalkIn(w => ({ ...w, chosen: table.id }));
  };
  const closeWalkIn = () => setWalkIn(null);
  const addWith = (product, chosen = []) => {
    const res = addToCart(cart, { ...product, course_id: courseOfProduct(product, courses) }, 1, chosen);
    if (res.blocked) return showToast(`"${product.name}": disponibilità esaurita`, 'warning');
    setCart(res.cart);
  };
  // Un piatto con opzioni passa dalla scelta; gli altri entrano subito
  const add = (product) => (modifiers.forProduct(product).length ? setPicking(product) : addWith(product));

  if (!rooms) return <div className={`${card} flex-1`}><Loading /></div>;

  const seatedWalkIn = (check) => {
    const table = rooms.flatMap(r => r.tables).find(t => t.id === check.table_id);
    setWalkIn(null); setSelection({ table, checkId: check.id }); load();
  };
  const walkInPanel = walkIn && (
    <WalkInPanel rooms={rooms.filter(r => r.active)} reservations={reservations} checks={checks} chosen={walkIn.chosen}
      onChoose={(id) => setWalkIn(w => ({ ...w, chosen: id }))} onPreview={(fits, free, suggested) => setWalkIn(w => (w && (w.fits.join() !== fits.join() || w.free.join() !== free.join() || w.suggested !== suggested) ? { ...w, fits, free, suggested } : w))}
      onBack={closeWalkIn} onSeated={seatedWalkIn} />
  );
  const side = walkInPanel || (
    <SidePanel selection={selection} reservation={selection ? reserved.get(selection.table.id) : null} user={user} service={service} event={event} ordering={ordering}
      cart={cart} setCart={setCart} products={products} courses={courses}
      onBack={close} onOpened={(check) => { setSelection(s => ({ ...s, checkId: check.id })); load(); }} onBusy={close}
      onOrder={() => setOrdering(true)} onDraftBack={() => (narrow ? setDraftOpen(false) : setOrdering(false))}
      onSent={() => { reset(); load(); }} onChanged={load}
      onSwitch={(check) => { reset(); setSelection({ table: rooms.flatMap(r => r.tables).find(t => t.id === check.table_id), checkId: check.id }); load(); }} />
  );
  const floor = <FloorView reserve={reserve} rooms={rooms} checks={checks} reserved={reserved} selectedTableId={selection?.table.id} onSelect={select} walkIn={walkIn} onWalkIn={() => { reset(); setSelection(null); setWalkIn({ chosen: null, suggested: null, fits: [], free: [] }); }}
    onOpenReservation={(r) => navigate('/reservations', { state: { reservationId: r.id, date: r.date } })} />;
  const menu = picking
    ? <ModifierPicker key={picking.id} product={picking} groups={modifiers.forProduct(picking)} onCancel={() => setPicking(null)} onAdd={(chosen) => { addWith(picking, chosen); setPicking(null); }} />
    : <OrderMenu products={products} cart={cart} tableName={selection?.table.name} onAdd={add} onBack={() => { setOrdering(false); setDraftOpen(false); }} />;

  if (!narrow) {
    return (
      <div className="relative flex-1 min-h-0 min-w-0">
        {/* Il riquadro di lavoro ha sempre la stessa misura: con la comanda la carta si fa da parte con il padding, la pianta con un transform */}
        <div style={{ paddingRight: ordering && reserve ? reserve + 20 : undefined }}
          className={`${card} h-full transition-[padding] duration-[420ms] ease-[cubic-bezier(0.32,0.72,0,1)] ${ordering ? 'overflow-y-auto no-scrollbar' : 'overflow-hidden'}`}>{ordering ? menu : floor}</div>
        {/* Senza un tavolo scelto la pianta prende tutto lo spazio: il pannello scorre dentro solo quando serve */}
        <SlidePanel open={!!(selection || walkIn)}>{side}</SlidePanel>
      </div>
    );
  }

  // Schermo stretto: i tavoli, e sopra a tutto schermo il pannello (o la carta con la comanda in basso)
  return (
    <>
      <div className={`${card} flex-1 min-h-0 overflow-hidden`}>{floor}</div>
      {(selection || walkIn) && (
        <div className="motion-page fullscreen-sheet fixed inset-0 z-[1700] bg-[var(--bg-main)]">
          {ordering ? (
            <div className="flex flex-col h-full gap-3">
              <div className={`${card} flex-1 min-h-0 overflow-hidden`}>{menu}</div>
              <button className={`${btnPrimary} w-full !py-4 !text-sm shrink-0`} onClick={() => setDraftOpen(true)}>
                <ShoppingBag size={18} /> Comanda · {cart.reduce((s, l) => s + l.quantity, 0)} · {formatEuro(cartTotal(cart))}
              </button>
              {draftOpen && <div className="fullscreen-sheet fixed inset-0 z-[1750] bg-[var(--bg-main)]">{side}</div>}
            </div>
          ) : side}
        </div>
      )}
    </>
  );
};

export default FloorPage;
