// Schermata a tutto schermo con il contenuto al centro (accesso, cambio password, console master). Scorre da sola se il
// contenuto non ci sta (telefono in orizzontale, tastiera aperta): il `body` dell'app è bloccato, quindi serve un contenitore proprio.
const CenteredScreen = ({ children }) => (
  <div className="fixed inset-0 overflow-y-auto bg-[var(--bg-main)]">
    <div className="app-safe min-h-full flex flex-col items-center justify-center gap-0 p-4">{children}</div>
  </div>
);

export default CenteredScreen;
