import { STATUS } from './rules';

const TONES = {
  amber: 'bg-amber-500/15 text-amber-500',
  green: 'bg-emerald-500/15 text-emerald-500',
  accent: 'bg-[var(--accent)]/15 text-[var(--accent)]',
  muted: 'bg-[var(--bg-card-2)] text-[var(--text-muted)]',
};

const StatusChip = ({ status }) => {
  const s = STATUS[status] ?? { label: status, tone: 'muted' };
  return <span className={`inline-flex items-center h-6 px-2.5 rounded-full text-xs font-medium ${TONES[s.tone]}`}>{s.label}</span>;
};

export default StatusChip;
