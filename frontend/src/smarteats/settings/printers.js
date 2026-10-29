// Le tre stampanti di un ristorante e come si legano alle «copie» di stampa del server (`copy_types`): il locale non deve sapere cosa
// sia una copia, sceglie dove escono le comande della cucina, quelle del bar e il conto. Logica pura (testata).
// `template` è il nome della copia nei modelli di stampa (print/templates.js). «Conto» non ha un modello di comanda: serve solo
// da stampante della ricevuta, quindi non stampa copie a ogni portata mandata in cucina.
export const PRINTERS = [
  { id: 'kitchen', template: 'Cucina', label: 'Comanda cucina', hint: 'Esce a ogni portata mandata in cucina.' },
  { id: 'bar', template: 'Ritiro Bar', label: 'Comanda bar', hint: 'Solo le bevande e i piatti del bar.' },
  { id: 'check', template: 'Conto', label: 'Conto e ricevute', hint: 'Il conto del tavolo e le ricevute dei pagamenti.' },
];

// La riga di print_settings di una stampante, o undefined se non è mai stata configurata.
export const settingFor = (printer, settings) => settings.find(s => s.copy_type_name === printer.template);

// Una stampante è «pronta» se ha un indirizzo ed è accesa.
export const isReady = (setting) => !!setting && setting.enabled && !!setting.printer_address;
