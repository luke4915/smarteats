// Schermata a tutto schermo con il contenuto al centro (accesso, cambio password, console master). Scorre da sola se il
// contenuto non ci sta (telefono in orizzontale, tastiera aperta): il `body` dell'app è bloccato, quindi serve un contenitore proprio.
// `glow`: un velo di colore d'accento in alto, per le schermate d'ingresso.
const CenteredScreen = ({ glow = false, children }) => (
  <div className="fixed inset-0 overflow-y-auto bg-[var(--bg-main)]">
    {glow && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-3/5 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--accent)_16%,transparent),transparent_70%)]" />}
    <div className="relative min-h-full flex flex-col items-center justify-center pt-[max(1rem,env(safe-area-inset-top))] pb-4 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">{children}</div>
  </div>
);

export default CenteredScreen;
