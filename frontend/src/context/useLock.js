import { createContext, useContext } from 'react';

// Contesto del blocco dello schermo: il valore (locked, lock, unlock, autoLockMinutes…) lo fornisce LockProvider.
export const LockContext = createContext({ locked: false, canLock: false, lock: () => false, unlock: () => {}, autoLockMinutes: 0, setAutoLockMinutes: () => {} });

export const useLock = () => useContext(LockContext);
