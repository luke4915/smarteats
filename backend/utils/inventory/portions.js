// Le porzioni di un piatto («oggi ne ho 40») e cosa succede quando comincia un servizio. Logica pura, senza database:
// la provano i test (tests/portions.test.js) e la usano le route dei prodotti e l'apertura del servizio.
//
// Un piatto ha tre dati: `stock_enabled` (le porzioni si contano), `stock` (quante ne restano) e la REGOLA di azzeramento:
//   restart_each_service  all'apertura del servizio le porzioni tornano a `portions_start` (la regola di partenza consigliata)
//   carry_over            si continua dal servizio prima (una torta fatta per due giorni)
//   unlimited             all'apertura del servizio torna illimitato (come prima che esistesse il magazzino)

export const PORTIONS_RULES = ['restart_each_service', 'carry_over', 'unlimited'];

// Un piatto finito (stock 0) si nasconde da solo; quando torna disponibile deve ricomparire. Uno nascosto a mano dall'admin resta nascosto.
const visibleAgain = (product) => product.visible || product.stock === 0;

// Come si presenta il piatto all'apertura di un nuovo servizio: { stock, stock_enabled, visible }.
export function portionsAtServiceStart(product) {
  const keep = { stock: product.stock, stock_enabled: product.stock_enabled, visible: product.visible };
  if (product.portions_reset_rule === 'restart_each_service' && product.portions_start != null) {
    return { stock: product.portions_start, stock_enabled: true, visible: visibleAgain(product) };
  }
  if (product.portions_reset_rule === 'carry_over') return keep;
  return { stock: null, stock_enabled: false, visible: visibleAgain(product) };       // unlimited
}

// Cosa cambia quando l'admin salva la regola di un piatto a servizio già aperto: { stock, stock_enabled, visible }.
// Una regola «riparti da N» vale subito se il piatto era illimitato; se contava già le porzioni, il conto di adesso non si tocca.
export function portionsAfterRuleSaved(product, rule, start) {
  const keep = { stock: product.stock, stock_enabled: product.stock_enabled, visible: product.visible };
  if (rule === 'restart_each_service' && !product.stock_enabled) return { stock: start, stock_enabled: true, visible: product.visible };
  if (rule === 'unlimited') return { stock: null, stock_enabled: false, visible: visibleAgain(product) };
  return keep;
}
