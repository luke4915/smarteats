import { useTheme } from './useTheme';

// Il tema delle pagine dei clienti (menu, prenotazioni, ordine, privacy): segue il dispositivo (chiaro o scuro) finché il cliente non sceglie
// «Chiaro» o «Scuro» dal selettore in fondo alla pagina (`PublicShell`); la scelta si ricorda su quel telefono. Ritorna [scelta, cambia].
export const useSystemTheme = () => useTheme('auto');
