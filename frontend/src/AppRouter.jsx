import { lazy, Suspense } from 'react';
import App from './App';
import { useAuth } from './context/useAuth';
import { usesSmartEats } from './apps/restaurant/views';
import { isPublicPath } from './utils/publicPaths';

const SmartEatsApp = lazy(() => import('./apps/restaurant/SmartEatsApp'));

// Un locale è una sagra (o un paninaro) oppure un ristorante: sono due app distinte, mai mescolate.
// Chi è già autenticato in un locale di tipo ristorante entra in SmartEats; tutto il resto (login, cambio
// password temporanea, sagre, pagine pubbliche) resta ad App.
const AppRouter = () => {
  const { user, loading } = useAuth();
  const shared = isPublicPath(window.location.pathname);   // pagine pubbliche: le gestisce App, anche per chi è collegato
  if (!loading && user && !user.needsPassword && usesSmartEats(user) && !shared) {
    return (
      <Suspense fallback={<div className="h-dvh flex items-center justify-center bg-[var(--bg-main)] text-[var(--text-main)]">Caricamento...</div>}>
        <SmartEatsApp />
      </Suspense>
    );
  }
  return <App />;
};

export default AppRouter;
