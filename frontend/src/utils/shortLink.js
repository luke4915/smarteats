// Il bottone «Vedi dettagli» dei messaggi WhatsApp punta a `/s/<locale>/<book|order>/<codice>` sul dominio principale.
// Da qui si ricava l'indirizzo della pagina di stato sul sottodominio del locale.
export const SHORT_LINK = /^\/s\/([a-z0-9-]{1,50})\/(book|order)\/([A-Za-z0-9_-]{10,80})\/?$/;

// `https://pizzeria-rossi.standmanager.it/book/<codice>`, o null se il percorso non è un link valido
export function shortLinkTarget(pathname, protocol, host) {
  const m = SHORT_LINK.exec(pathname);
  return m ? `${protocol}//${m[1]}.${host}/${m[2]}/${m[3]}` : null;
}
