import { motion } from 'framer-motion';
import { DISCLAIMER } from '../../models/constants';

type Props = { onClose: () => void };

export function AboutModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <motion.div className="glass modal" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
        <h2 id="about-title">About this tool</h2>
        <p>{DISCLAIMER}</p>
        <ol>
          <li>
            <strong>What.</strong> A decision-support diagnostic for JS dependency inventory, bundle-risk signals, and
            labeled delivery-cost estimates.
          </li>
          <li>
            <strong>Who.</strong> Staff+ web engineers, staff+ platform, and tech leads who need to decide what to
            measure or remove next.
          </li>
          <li>
            <strong>Why it wins.</strong> It refuses to treat package count as shipped JavaScript, and it shows the
            calculation on every card.
          </li>
          <li>
            <strong>Structure.</strong> Ingest → normalize graph → optional public lookups → pure models → labeled
            report.
          </li>
          <li>
            <strong>Discover.</strong> Public GitHub repo, README, and the pipeline visualization.
          </li>
          <li>
            <strong>Engage.</strong> Upload, public URL, snippet/OCR, or Load demo.
          </li>
          <li>
            <strong>Convert.</strong> Export a PR-safe note or generate a warning-first workflow (not auto-committed).
          </li>
          <li>
            <strong>Money.</strong> Time-value is potential under assumptions and stays hidden until you opt in. This
            preview is not a paid product.
          </li>
          <li>
            <strong>Launch.</strong> GitHub Pages public preview. Private OAuth stays a documented server path.
          </li>
          <li>
            <strong>Improve.</strong> Add measured artifacts, then tighten recommendations from measure-first to remove
            or replace.
          </li>
        </ol>
        <p className="muted">
          KPIs: analyses completed → <span className="mono">tool_complete</span>. Recommendation exports →{' '}
          <span className="mono">content_engagement_click</span>. Workflow generated →{' '}
          <span className="mono">self_serve_cta_click</span>.
        </p>
        <button type="button" className="btn primary" onClick={onClose}>
          Close
        </button>
      </motion.div>
    </div>
  );
}
