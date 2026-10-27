import { createContext, useContext } from 'react';

// Stato dei dati riservati (costi, margini, statistiche): lo fornisce ReservedDataProvider.
// { ready, enabled, locked, unlockedUntil, unlock(password), lock(), refresh() }
export const ReservedDataContext = createContext({ ready: true, enabled: false, locked: false, unlockedUntil: null, unlock: async () => {}, lock: async () => {}, refresh: async () => {} });

export const useReservedData = () => useContext(ReservedDataContext);
