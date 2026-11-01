// Le pagine che si aprono senza accedere (clienti, schermo cucina, console master): non dipendono da chi è collegato in questo browser.
// Per loro non vale il blocco dello schermo, non serve cambiare la password temporanea né aspettare il controllo della sessione: un cliente
// che apre il menu dal telefono non deve mai trovarsi davanti altro. Provata in publicPaths.test.js.
const EXACT = ['/kds', '/menu', '/master', '/privacy', '/terms'];
const PREFIXES = ['/book', '/order', '/s', '/mock-checkout'];

// Con o senza barra finale (`/menu/` è la stessa pagina di `/menu`)
export const isPublicPath = (path) => {
  const clean = path.length > 1 ? path.replace(/\/+$/, '') : path;
  return EXACT.includes(clean) || PREFIXES.some(p => clean === p || clean.startsWith(`${p}/`));
};
