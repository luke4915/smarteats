// Preferenze delle notifiche di questo dispositivo (ogni telefono o tablet sceglie per sé): suono acceso o spento.
const KEY = 'standmanager:notify_sound';

export const isNotifySoundOn = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } };
export const setNotifySound = (on) => { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* senza archivio locale */ } };
