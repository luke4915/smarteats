import { useIsMobile } from '../../hooks/useBreakpoint';

// Misure del pannello a destra (SlidePanel): larghezza (più larga dagli schermi grandi) e distanza dall'area di lavoro.
export const PANEL_GAP = 16;
export const usePanelWidth = () => (useIsMobile(1280) ? 380 : 420);

// Quanto spazio a destra lascia il pannello all'area di lavoro (0 quando è chiuso): serve a chi sta sotto per farsi da parte.
export const usePanelReserve = (open) => { const width = usePanelWidth(); return open ? width + PANEL_GAP : 0; };
