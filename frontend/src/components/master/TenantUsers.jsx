import { useMemo } from 'react';
import { apiFetch } from '../../utils/apiClient';
import UsersPanel from '../shared/UsersPanel';

// Scheda «Utenti» della finestra di un locale, vista dal master: elenco, creazione, cambio ruolo/username, password temporanea, eliminazione.
const TenantUsers = ({ tenant, onChanged }) => {
  const api = useMemo(() => {
    const base = `/master/tenants/${tenant.id}/users`;
    // dopo ogni modifica il pannello aggiorna anche il conteggio utenti dell'elenco tenant
    const changed = async (promise) => { const result = await promise; onChanged?.(); return result; };
    return {
      list: () => apiFetch(base),
      create: (body) => changed(apiFetch(base, { method: 'POST', body })),
      update: (id, body) => changed(apiFetch(`${base}/${id}`, { method: 'PATCH', body })),
      remove: (id) => changed(apiFetch(`${base}/${id}`, { method: 'DELETE' })),
      resetPassword: (id, password) => apiFetch(`${base}/${id}/reset-password`, { method: 'POST', body: { password } }),
    };
  }, [tenant.id, onChanged]);

  return <UsersPanel api={api} />;
};

export default TenantUsers;
