import { useEffect, useState } from 'react';
import { CircleCheck, TriangleAlert } from 'lucide-react';
import { APP_VERSION } from '../../utils/appVersion';
import { useAuth } from '../../context/useAuth';
import { fetchWithAuth } from '../../utils/apiClient';
import { recall } from '../../offline/lastKnown';
import { licenseStatus, licenseMessage } from '../../utils/licenseStatus';
import { formatDateTime } from '../../utils/format';

// Impostazioni → Informazioni: versione di SmartEats, il locale e lo stato della licenza (la scadenza la dà il server; senza rete si legge l'ultima nota).
const Row = ({ label, children }) => (
  <div className="flex items-baseline justify-between gap-4 px-4 py-3">
    <dt className="text-sm text-[var(--text-muted)]">{label}</dt>
    <dd className="text-sm text-[var(--text-main)] text-right min-w-0">{children}</dd>
  </div>
);

const AboutSection = () => {
  const { user } = useAuth();
  const [license, setLicense] = useState(() => recall('license'));
  useEffect(() => { fetchWithAuth('/auth/me').then(me => me?.license && setLicense(me.license)).catch(() => { /* senza rete resta l'ultima licenza nota */ }); }, []);

  const status = licenseStatus(license);
  const msg = licenseMessage(status);
  const Icon = msg.tone === 'ok' ? CircleCheck : TriangleAlert;
  const color = msg.tone === 'ok' ? 'text-emerald-500' : msg.tone === 'warn' ? 'text-amber-500' : 'text-red-500';

  return (
    <div className="space-y-4">
      <div className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] p-5 flex items-start gap-3">
        <Icon size={22} className={`shrink-0 mt-0.5 ${color}`} aria-hidden="true" />
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[var(--text-main)]">{msg.title}</h2>
          {msg.detail && <p className="text-sm text-[var(--text-muted)] mt-0.5">{msg.detail}</p>}
          {license?.expiresAt && <p className="text-xs text-[var(--text-muted)] mt-1">Scadenza: {formatDateTime(license.expiresAt)}. Per rinnovarla scrivi al tuo referente SmartEats.</p>}
        </div>
      </div>
      <dl className="bg-[var(--bg-card)] rounded-xl border border-[var(--border)] divide-y divide-[var(--border)]">
        <Row label="Locale">{user.tenantName}</Row>
        <Row label="Versione di SmartEats">{APP_VERSION}</Row>
      </dl>
    </div>
  );
};

export default AboutSection;
