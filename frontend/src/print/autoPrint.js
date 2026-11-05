// Le stampe automatiche sono una scelta di questo dispositivo (la stampante la raggiunge lui): si ricordano nel browser, spente di partenza.
//   receipt   ricevuta del conto subito dopo ogni incasso
//   takeaway  comanda di cucina appena si accetta un ordine d'asporto che va in cucina oggi
const key = (name) => `autoprint_${name}`;
export const autoPrintOn = (name) => { try { return localStorage.getItem(key(name)) === 'on'; } catch { return false; } };
export const setAutoPrint = (name, on) => { try { localStorage.setItem(key(name), on ? 'on' : 'off'); } catch { /* senza archivio locale vale solo finché la pagina resta aperta */ } };
