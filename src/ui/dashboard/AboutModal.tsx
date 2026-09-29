import { DISCLAIMER } from '../../models/constants';

type Props = { onClose: () => void };

export function AboutModal({ onClose }: Props) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="about-title">
      <div className="glass modal">
        <h2 id="about-title">About this tool</h2>
        <p>{DISCLAIMER}</p>
        <p>
          <strong>What.</strong> A local-first decision-support diagnostic. It turns manifests, lockfiles, optional
          bundler or CI artifacts, and import snippets into a labeled inventory and cost report.
        </p>
        <p>
          <strong>What it is not.</strong> Not a paid product. Not a production security product. Not recovered payroll.
          Package count is not shipped JavaScript. Time-value stays hidden until you opt in under Assumptions.
        </p>
        <p>
          <strong>Evidence.</strong> Strongest available of: production bundle / source map / metafile, CI timestamps,
          resolved lockfile, Bundlephobia advisory (never summed as your bundle), then package.json or import screenshot.
        </p>
        <p>
          <strong>Who.</strong> Staff+ web and platform engineers, and tech leads, deciding what to measure or remove
          next.
        </p>
        <p className="muted">This preview makes no production security-posture claim.</p>
        <button type="button" className="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
