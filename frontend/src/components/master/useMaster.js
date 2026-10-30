import { useState, useEffect, useCallback } from 'react';
import { apiFetch, ApiError } from '../../utils/apiClient';

// Tutto ciò che la console master chiede al server: accesso, elenco dei locali, catalogo, feedback e le azioni sui locali
// (crea, rinomina, allunga la licenza, attiva/disattiva, elimina). La grafica (MasterPage) riceve stato e funzioni già pronti.
export function useMaster() {
  const [authed, setAuthed] = useState(false);
  const [busy, setBusy] = useState(false);          // accesso in corso
  const [error, setError] = useState('');
  const [tenants, setTenants] = useState([]);
  const [catalog, setCatalog] = useState(null);
  const [feedback, setFeedback] = useState([]);

  const loadTenants = useCallback(async () => {
    try { setTenants(await apiFetch('/master/tenants')); }
    catch (err) { if (err instanceof ApiError && err.status === 401) setAuthed(false); else setError(err.message); }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadTenants();
    apiFetch('/master/catalog').then(setCatalog).catch(err => setError(err.message));
    apiFetch('/master/feedback').then(setFeedback).catch(() => {});
  }, [authed, loadTenants]);

  // Esegue un'azione sul server: azzera l'errore, ricarica l'elenco se va bene, mostra l'errore se no. Dice se è riuscita.
  const run = useCallback(async (action) => {
    setError('');
    try { await action(); await loadTenants(); return true; }
    catch (err) { setError(err.message); return false; }
  }, [loadTenants]);

  const login = async (password) => {
    setBusy(true); setError('');
    try { await apiFetch('/master/login', { method: 'POST', body: { password } }); setAuthed(true); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    await apiFetch('/master/logout', { method: 'POST' }).catch(() => {});
    setAuthed(false); setTenants([]);
  };
  const markFeedback = async (f, status) => {
    try { await apiFetch(`/master/feedback/${f.id}`, { method: 'PATCH', body: { status } }); setFeedback(list => list.map(x => (x.id === f.id ? { ...x, status } : x))); }
    catch (err) { setError(err.message); }
  };

  return {
    authed, busy, error, setError, tenants, catalog, feedback, loadTenants, login, logout, markFeedback,
    createTenant: (form) => run(() => apiFetch('/master/tenants', { method: 'POST', body: form })),
    extend: (id, days) => run(() => apiFetch(`/master/tenants/${id}/extend`, { method: 'PATCH', body: { days } })),
    rename: (id, name) => run(() => apiFetch(`/master/tenants/${id}/name`, { method: 'PATCH', body: { name } })),
    setActive: (id, active) => run(() => apiFetch(`/master/tenants/${id}/active`, { method: 'PATCH', body: { active } })),
    deleteTenant: (t) => run(() => apiFetch(`/master/tenants/${t.id}`, { method: 'DELETE', body: { confirmSlug: t.slug } })),
  };
}
