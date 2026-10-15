import { useEffect } from 'react';
import { PublicShell } from '../components/public/PublicShell';
import { useSystemTheme } from '../hooks/useSystemTheme';
import { shortLinkTarget } from '../utils/shortLink';

// Il bottone «Vedi dettagli» dei messaggi WhatsApp punta a `/s/<locale>/<book|order>/<codice>` sul dominio principale
// (un solo indirizzo per tutti i modelli di Meta): qui si passa alla pagina di stato sul sottodominio del locale.
const ShortLink = () => {
  useSystemTheme();
  const target = shortLinkTarget(window.location.pathname, window.location.protocol, window.location.host);
  useEffect(() => { if (target) window.location.replace(target); }, [target]);
  return (
    <PublicShell>
      <p className="text-sm text-[var(--text-muted)] text-center py-16">{target ? 'Ti stiamo portando alla tua richiesta…' : 'Link non valido.'}</p>
    </PublicShell>
  );
};

export default ShortLink;
