import { useEffect } from 'react';

// Il titolo della scheda del browser dice dove sei: «Cucina · Nome del locale». Se ci sono notifiche da gestire
// compare davanti il numero, «(2) Cucina · …», così si vede anche con la scheda in secondo piano.
export function usePageTitle(page, tenantName, pending = 0) {
  useEffect(() => {
    const base = [page, tenantName].filter(Boolean).join(' · ') || 'SmartEats';
    document.title = pending > 0 ? `(${pending}) ${base}` : base;
  }, [page, tenantName, pending]);
}
