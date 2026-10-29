// Lo stile dei piccoli indicatori di stato in testata (offline, stampe in attesa, ordini rifiutati): compaiono solo quando serve.
export const chip = (tone) => `flex items-center gap-1.5 h-9 coarse:h-11 px-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition-colors ${tone === 'red'
  ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20'
  : 'bg-amber-500/10 border-amber-500/30 text-amber-500 hover:bg-amber-500/20'}`;
