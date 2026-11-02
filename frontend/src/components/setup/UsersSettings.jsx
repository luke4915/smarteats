import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { fetchWithAuth } from '../../utils/apiClient';
import { useAuth } from '../../context/useAuth';
import UsersPanel from '../shared/UsersPanel';
import ProfileForm from '../shared/ProfileForm';
import { forgetVerifier } from '../../offline/pinVerifier';

// Utenti del proprio tenant (solo admin), con il proprio profilo nella riga «Tu».
const UsersSettings = () => {
  const { user, login } = useAuth();
  const api = useMemo(() => ({
    list: () => fetchWithAuth('/auth/admin/users'),
    create: (body) => fetchWithAuth('/auth/admin/createUser', { method: 'POST', body }),
    update: (id, body) => fetchWithAuth(`/auth/admin/users/${id}`, { method: 'PATCH', body }),
    remove: (id) => fetchWithAuth(`/auth/admin/users/${id}`, { method: 'DELETE' }),
    resetPassword: (id, password) => fetchWithAuth(`/auth/admin/users/${id}/reset-password`, { method: 'POST', body: { password } }),
    // Se l'amministratore cambia il proprio PIN, «Blocca schermo» compare (o sparisce) subito nel suo menu
    setPin: async (id, pin) => { await fetchWithAuth(`/pin/users/${id}`, { method: 'PUT', body: { pin } }); if (id === user.id) { forgetVerifier(id); login({ ...user, hasPin: true, pinLength: pin.length, pinSetAt: undefined }); } },
    clearPin: async (id) => { await fetchWithAuth(`/pin/users/${id}`, { method: 'DELETE' }); if (id === user.id) { forgetVerifier(id); login({ ...user, hasPin: false, pinLength: null, pinSetAt: undefined }); } },
  }), [user, login]);

  return (
    <div className="bg-[var(--bg-card)] p-5 rounded-xl border border-[var(--border)]">
      <h2 className="text-base font-semibold text-[var(--text-main)] mb-4 flex items-center gap-2">
        <Users size={15} /> Utenti
      </h2>
      <UsersPanel api={api} currentUserId={user.id} renderProfile={(onSaved) => <ProfileForm onSaved={onSaved} />} />
    </div>
  );
};

export default UsersSettings;
