// Mentre i dati arrivano: righe grigie che pulsano, della forma di un elenco, al posto di un «Caricamento…» che appare e sparisce.
// `rows` quante righe mostrare; per chi usa lo screen reader dice «Caricamento».
const Loading = ({ rows = 3, className = '' }) => (
  <div role="status" aria-label="Caricamento" className={`space-y-2 ${className}`}>
    {Array.from({ length: rows }, (_, i) => <div key={i} className="h-12 rounded-xl bg-[var(--bg-card-2)] animate-pulse" style={{ opacity: 1 - i * 0.2 }} />)}
  </div>
);

export default Loading;
