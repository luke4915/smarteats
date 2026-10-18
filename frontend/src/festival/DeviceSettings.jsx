import { Moon, Volume2, Zap } from 'lucide-react';
import Switch from '../components/shared/Switch';

const Row = ({ icon, title, hint, children }) => {
  const Icon = icon;
  return (
  <div className="flex items-center gap-4 px-4 py-3.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)]">
    <Icon size={20} className="shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
    <div className="min-w-0 flex-1">
      <p className="text-sm font-medium text-[var(--text-main)]">{title}</p>
      <p className="text-xs text-[var(--text-muted)] mt-0.5">{hint}</p>
    </div>
    {children}
  </div>
  );
};

// Le preferenze di questo dispositivo: tema, suono al tocco e modalità degli ordini (valgono solo qui, non per le altre casse).
const DeviceSettings = ({ theme, setTheme, isSoundEnabled, setIsSoundEnabled, orderMode, setOrderMode }) => (
  <div className="space-y-2">
    <Row icon={Moon} title="Tema scuro" hint="Si legge meglio con le luci della sagra la sera.">
      <Switch checked={theme === 'dark'} onChange={(on) => setTheme(on ? 'dark' : 'light')} label="Tema scuro" />
    </Row>
    <Row icon={Volume2} title="Suono al tocco" hint="Un breve suono quando aggiungi un prodotto e quando invii l'ordine.">
      <Switch checked={isSoundEnabled} onChange={setIsSoundEnabled} label="Suono al tocco" />
    </Row>
    <Row icon={Zap} title="Ordini avanzati" hint="Spenta: l'ordine è completato subito. Accesa: va in cucina e si completa a mano.">
      <Switch checked={orderMode === 'advanced'} onChange={(on) => setOrderMode(on ? 'advanced' : 'simple')} label="Ordini avanzati" />
    </Row>
  </div>
);

export default DeviceSettings;
