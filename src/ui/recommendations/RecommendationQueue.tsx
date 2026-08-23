import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Recommendation } from '../../schemas/report';

type Props = {
  items: Recommendation[];
  lowOverwhelm: boolean;
};

export function RecommendationQueue({ items, lowOverwhelm }: Props) {
  const [index, setIndex] = useState(0);
  const visible = lowOverwhelm ? items.slice(index, index + 1) : items;

  return (
    <article className="glass card">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Recommendation queue</h3>
        <span className="badge medium">{items.length} items</span>
      </div>
      <p className="muted">
        measure-first is the default when artifacts are absent. Security-sensitive packages are not auto-swapped.
      </p>
      <div className="rec-queue">
        <AnimatePresence mode="wait">
          {visible.map((item) => (
            <motion.section
              key={item.id}
              className="glass card"
              initial={lowOverwhelm ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <strong>{item.title}</strong>
                <span className={`badge ${item.confidence}`}>{item.confidence}</span>
              </div>
              <p>{item.action}</p>
              <p className="mono muted">
                {item.category} · migration risk {item.migrationRisk}
              </p>
              <details>
                <summary>Evidence</summary>
                <ul>
                  {item.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </details>
            </motion.section>
          ))}
        </AnimatePresence>
      </div>
      {lowOverwhelm && items.length > 1 ? (
        <div className="header-actions" style={{ marginTop: 12 }}>
          <button type="button" className="btn hit-lg" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
            Previous
          </button>
          <span className="muted">
            {index + 1} of {items.length}
          </span>
          <button
            type="button"
            className="btn primary hit-lg"
            disabled={index >= items.length - 1}
            onClick={() => setIndex((i) => i + 1)}
          >
            Next one thing
          </button>
        </div>
      ) : null}
    </article>
  );
}
