// Catalogo dei moduli e dei tipi di attività: unica fonte di verità per backend, validazione e pannello master
// (che lo legge da GET /master/catalog). Un modulo nuovo si aggiunge qui e si applica con requireModule.
//
// Il nucleo (login, utenti, prodotti, ordini, sessioni, stampa, impostazioni) non è un modulo: c'è sempre.

// Un locale è di un solo tipo, deciso alla creazione: street food (sagre, paninari, food truck) e ristorante sono due prodotti distinti (due app,
// stesso backend). Ogni modulo dichiara per quali tipi esiste; un tipo non può accendere i moduli degli altri.
const ALL_TYPES = ['street_food', 'restaurant', 'takeaway_shop'];
export const MODULES = {
  kds: { label: 'Schermo cucina (KDS)', types: ALL_TYPES },
  stats: { label: 'Statistiche', types: ALL_TYPES },
  qr_menu: { label: 'Menu pubblico con QR', types: ['street_food'] },
  tables: { label: 'Sala e tavoli', types: ['restaurant'] },
  bookings: { label: 'Prenotazioni', types: ['restaurant'] },
  takeaway: { label: 'Asporto', types: ALL_TYPES },
  whatsapp: { label: 'Avvisi WhatsApp', types: ['restaurant', 'takeaway_shop'] },
  inventory: { label: 'Magazzino e scorte', types: ALL_TYPES },   // funzione a pagamento: modalità e modo di scalare li sceglie il master
};

// Il tipo di attività propone i moduli di partenza; poi il master può accendere o spegnere quelli che esistono per il tipo.
export const BUSINESS_TYPES = {
  street_food: { label: 'SmartEats Stand · sagra, paninaro o food truck', modules: ['kds', 'stats', 'qr_menu'] },
  restaurant: { label: 'SmartEats Restaurant · ristorante o pizzeria', modules: ['kds', 'stats', 'tables'] },
  takeaway_shop: { label: 'SmartEats Restaurant · solo asporto (pizzeria da taglio, forno, rosticceria)', modules: ['kds', 'stats', 'takeaway'] },
};

// Magazzino (modulo `inventory`, disegno in docs/design-magazzino.md). Modalità: `portions` = conteggio per piatto, azzerato a ogni
// servizio; `warehouse` = ingredienti, fornitori, costi. Scarico: `recipes` = gli ingredienti si scalano dalle ricette;
// `simple` = senza ricette, a mano a fine servizio. Spento = il modulo non c'è. Le sceglie solo il master.
export const INVENTORY_MODES = { portions: 'Porzioni', warehouse: 'Magazzino' };
export const INVENTORY_DEPLETIONS = { recipes: 'Dalle ricette', simple: 'Scarico semplificato' };
export const DEFAULT_INVENTORY = { mode: 'portions', depletion: 'recipes' };

export const MODULE_IDS = Object.keys(MODULES);
export const BUSINESS_TYPE_IDS = Object.keys(BUSINESS_TYPES);

// Ritorna i moduli in ordine di catalogo e senza doppioni.
export const normalizeModules = (modules) => MODULE_IDS.filter(id => modules.includes(id));

// Primo modulo non ammesso per il tipo, o undefined se vanno bene tutti.
export const firstModuleNotAllowed = (businessType, modules) => modules.find(id => !MODULES[id]?.types.includes(businessType));

// Come lavora il magazzino di un locale: { mode, depletion } se il modulo è acceso, altrimenti null.
// Accetta una riga della tabella tenants (colonne inventory_mode e inventory_depletion).
export const inventoryOf = (tenantRow) => (tenantRow.modules.includes('inventory')
  ? { mode: tenantRow.inventory_mode ?? DEFAULT_INVENTORY.mode, depletion: tenantRow.inventory_depletion ?? DEFAULT_INVENTORY.depletion }
  : null);

// Le colonne da salvare quando il master cambia i moduli: se il magazzino si accende vale quanto chiesto, altrimenti ciò che c'era
// o il predefinito; se si spegne la modalità si svuota (la regola di scarico resta, per quando si riaccende).
export function inventoryColumnsFor(modules, requested, current) {
  if (!modules.includes('inventory')) return { inventory_mode: null, inventory_depletion: current?.inventory_depletion ?? DEFAULT_INVENTORY.depletion };
  return {
    inventory_mode: requested?.mode ?? current?.inventory_mode ?? DEFAULT_INVENTORY.mode,
    inventory_depletion: requested?.depletion ?? current?.inventory_depletion ?? DEFAULT_INVENTORY.depletion,
  };
}

export const catalog = () => ({
  inventory: { modes: INVENTORY_MODES, depletions: INVENTORY_DEPLETIONS, defaults: DEFAULT_INVENTORY },
  modules: MODULE_IDS.map(id => ({ id, label: MODULES[id].label, types: MODULES[id].types })),
  businessTypes: BUSINESS_TYPE_IDS.map(id => ({ id, ...BUSINESS_TYPES[id] })),
});
