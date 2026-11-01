import { pointPosition, valueLabel } from './matrixData';
import { formatCents } from '../../utils/format';

// Il grafico della matrice: in orizzontale quanto si vende, in verticale quanto rende a ogni pezzo; le due linee tratteggiate sono le soglie
// che dividono i quattro gruppi. I punti dei punti di forza sono pieni, gli altri più chiari; il nome e i numeri sono nel suggerimento del
// punto (e nell'elenco per gruppi e nella tabella, che dicono le stesse cose).
const MatrixChart = ({ matrix }) => {
  const { items, mode, popularityThreshold, valueThreshold } = matrix;
  const scale = { maxQuantity: Math.max(...items.map(i => i.quantity)), maxValue: Math.max(...items.map(i => i.valueCents), valueThreshold, 1) };
  const cut = pointPosition({ quantity: popularityThreshold, valueCents: valueThreshold }, scale);
  return (
    <div>
      <div className="flex">
        <span className="w-5 shrink-0 text-xs text-[var(--text-muted)] [writing-mode:vertical-rl] rotate-180 text-center">{valueLabel(mode)}</span>
        <div className="relative flex-1 h-72 rounded-lg border border-[var(--border)] bg-[var(--bg-card-2)]" role="img" aria-label="Prodotti per vendite e rendimento">
          <span className="absolute inset-y-0 border-l border-dashed border-[var(--border-hover)]" style={{ left: `${cut.x}%` }} aria-hidden="true" />
          <span className="absolute inset-x-0 border-t border-dashed border-[var(--border-hover)]" style={{ bottom: `${cut.y}%` }} aria-hidden="true" />
          {items.map(i => {
            const { x, y } = pointPosition(i, scale);
            return (
              <span key={i.id} title={`${i.name} · ${i.quantity} pz · ${formatCents(i.valueCents)}`} tabIndex={0}
                className={`absolute -translate-x-1/2 translate-y-1/2 rounded-full ${i.klass === 'star' ? 'w-3.5 h-3.5 bg-[var(--accent)]' : i.klass === 'dog' ? 'w-3 h-3 bg-[var(--text-muted)]/50' : 'w-3 h-3 bg-[var(--accent)]/45'}`}
                style={{ left: `${x}%`, bottom: `${y}%` }} />
            );
          })}
        </div>
      </div>
      <p className="mt-1.5 text-xs text-[var(--text-muted)] text-center">Pezzi venduti →</p>
    </div>
  );
};

export default MatrixChart;
