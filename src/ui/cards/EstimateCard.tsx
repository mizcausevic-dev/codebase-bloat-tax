import { useState, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import type { Estimate } from '../../schemas/report';

type Props = {
  title: string;
  estimate: Estimate;
  extra?: ReactNode;
  lowOverwhelm?: boolean;
};

export function EstimateCard({ title, estimate, extra, lowOverwhelm }: Props) {
  const [open, setOpen] = useState(false);
  const value =
    estimate.value === null
      ? 'Unmeasured'
      : `${Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(estimate.value)} ${estimate.unit}`;

  return (
    <motion.article
      className="glass card"
      initial={lowOverwhelm ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: lowOverwhelm ? 0 : 0.35 }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className={`badge ${estimate.confidence}`}>{estimate.confidence}</span>
      </div>
      <p style={{ fontSize: '1.35rem', margin: '10px 0 6px' }}>{value}</p>
      {estimate.range ? (
        <p className="muted mono">
          Range {estimate.range.min.toFixed(1)} – {estimate.range.max.toFixed(1)} {estimate.unit}
        </p>
      ) : null}
      {extra}
      <button type="button" className="btn" onClick={() => setOpen((v) => !v)}>
        {open ? 'Hide calculation' : 'How this was calculated'}
      </button>
      {open ? (
        <div className="calc">
          <p>
            <strong>Method.</strong> {estimate.method}
          </p>
          <p>
            <strong>Assumptions.</strong>
          </p>
          <ul>
            {estimate.assumptions.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="mono">sourceVersion {estimate.sourceVersion}</p>
        </div>
      ) : null}
    </motion.article>
  );
}
