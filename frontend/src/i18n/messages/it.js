// Italiano: la lingua di partenza. Pagine dei clienti (menu con il QR, prenotazioni, ordine) e allergeni.
import { it as orders } from './orders.js';

export default {
  ...orders,
  'shell.privacy': 'Privacy', 'shell.terms': 'Condizioni d\'uso', 'shell.theme': 'Aspetto', 'shell.language': 'Lingua',
  'theme.auto': 'Auto', 'theme.light': 'Chiaro', 'theme.dark': 'Scuro', 'theme.toLight': 'Passa all\'aspetto chiaro', 'theme.toDark': 'Passa all\'aspetto scuro',
  'menu.title': 'Menu', 'menu.unavailable': 'Menu non disponibile al momento.', 'menu.search': 'Cerca un prodotto',
  'menu.noMatch': 'Nessun prodotto con «{query}».', 'menu.empty': 'Al momento non ci sono prodotti da scegliere.', 'menu.category': 'Categoria',
  'menu.add': 'Aggiungi', 'menu.addNamed': 'Aggiungi {name}', 'menu.less': 'Una in meno: {name}', 'menu.more': 'Una in più: {name}',
  'menu.items.one': '{count} articolo', 'menu.items.other': '{count} articoli', 'menu.showQr': 'Mostra il QR', 'menu.yourOrder': 'Il tuo ordine',
  'menu.total': 'Totale', 'menu.clear': 'Svuota', 'menu.clearConfirm': 'Sì, svuota', 'menu.close': 'Chiudi', 'menu.back': 'Indietro',
  'menu.showAtCashier': 'Mostra questo QR alla cassa', 'menu.showDirectly': 'Mostralo direttamente in cassa.', 'menu.enlarge': 'Ingrandisci', 'menu.enlargeAria': 'Ingrandisci il codice QR', 'menu.save': 'Salva',
  'nudge.also': 'Ci sta bene anche:', 'nudge.hide': 'Nascondi il suggerimento',
  'allergens.title': 'Allergeni', 'allergens.contains': 'Contiene: {list}', 'allergens.warn': 'Contiene {list}', 'allergens.filter': 'Allergie', 'allergens.filterActive.one': 'Allergie: {count}', 'allergens.filterActive.other': 'Allergie: {count}',
  'allergens.filterTitle': 'Cosa devi evitare?', 'allergens.filterHint': 'Segna gli allergeni da evitare: i prodotti che li contengono saranno segnalati.', 'allergens.clear': 'Azzera', 'allergens.done': 'Fatto',
  'allergens.disclaimer': 'Le informazioni sugli allergeni sono fornite dal locale. In caso di allergie o intolleranze chiedi sempre al personale.',
  'allergen.gluten': 'Cereali contenenti glutine', 'allergen.crustaceans': 'Crostacei', 'allergen.eggs': 'Uova', 'allergen.fish': 'Pesce', 'allergen.peanuts': 'Arachidi', 'allergen.soybeans': 'Soia', 'allergen.milk': 'Latte',
  'allergen.tree_nuts': 'Frutta a guscio', 'allergen.celery': 'Sedano', 'allergen.mustard': 'Senape', 'allergen.sesame': 'Semi di sesamo', 'allergen.sulphites': 'Anidride solforosa e solfiti', 'allergen.lupin': 'Lupini', 'allergen.molluscs': 'Molluschi',
};
