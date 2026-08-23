import type { CodebaseBloatReport } from '../../schemas/report';
import { EstimateCard } from '../cards/EstimateCard';
import { DependencyGraph } from '../graph/DependencyGraph';
import { RecommendationQueue } from '../recommendations/RecommendationQueue';
import { ConfigPanel, type OperatorConfig } from './ConfigPanel';

type Props = {
  report: CodebaseBloatReport;
  lowOverwhelm: boolean;
  config: OperatorConfig;
  onConfig: (c: OperatorConfig) => void;
  onExport: () => void;
  onWorkflow: () => void;
};

export function Dashboard({ report, lowOverwhelm, config, onConfig, onExport, onWorkflow }: Props) {
  return (
    <div className="grid full">
      <section className="glass card">
        <h2 style={{ marginTop: 0 }}>Evidence hierarchy</h2>
        <p>
          Strongest available tier: <strong>{report.evidenceQuality.strongestTier}</strong> / 5. Package metadata is not
          a build measurement.
        </p>
        <ol>
          <li>Production bundle / source map / metafile</li>
          <li>CI workflow timestamps</li>
          <li>Resolved lockfile</li>
          <li>Bundlephobia advisory (single-package min+gzip, never summed as your bundle)</li>
          <li>package.json or import screenshot (declared / candidate directs)</li>
        </ol>
        {report.evidenceQuality.notes.map((n) => (
          <p key={n} className="notice">
            {n}
          </p>
        ))}
      </section>

      <ConfigPanel config={config} onChange={onConfig} />

      <div className={lowOverwhelm ? 'grid full' : 'grid'}>
        <EstimateCard
          title="Bundle impact"
          estimate={report.bundle}
          lowOverwhelm={lowOverwhelm}
          extra={
            <div>
              <p className="muted">
                Kind: {report.bundle.kind === 'potential-package-footprint' ? 'potential package footprint' : report.bundle.kind}.
                Gzip is not uncompressed. Transfer is not parse time.
              </p>
              {report.bundle.entries.slice(0, 6).map((e) => (
                <p key={e.label} className="mono">
                  {e.label}: initial {e.initialBytes ?? '—'} / lazy {e.lazyBytes ?? '—'} / server {e.serverOnlyBytes ?? '—'}
                </p>
              ))}
            </div>
          }
        />
        <EstimateCard title="Mobile parse/eval" estimate={report.mobile} lowOverwhelm={lowOverwhelm} extra={<p className="muted">{report.mobile.limitation}</p>} />
        <EstimateCard
          title="Build wait"
          estimate={report.buildWait}
          lowOverwhelm={lowOverwhelm}
          extra={
            <p className="muted">
              Mode {report.buildWait.mode}.
              {report.buildWait.percentiles
                ? ` p50 ${report.buildWait.percentiles.p50 ?? '—'} / p75 ${report.buildWait.percentiles.p75 ?? '—'} / p95 ${report.buildWait.percentiles.p95 ?? '—'}`
                : ''}
            </p>
          }
        />
        <EstimateCard
          title="Potential time value"
          estimate={report.opportunityCost}
          lowOverwhelm={lowOverwhelm}
          extra={
            <p className="muted">
              {report.opportunityCost.annualBlockingHours.value?.toFixed(1)} hours / year under selected assumptions.
              Not guaranteed salary burn.
              {report.opportunityCost.inputsUsed.defaultsWereUsed ? ' Labeled defaults were used.' : ''}
            </p>
          }
        />
      </div>

      <article className="glass card">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>Security advisories</h3>
          <span className="badge low">distinct from performance</span>
        </div>
        <p className="muted">{report.security.note}</p>
        {report.security.findings.length === 0 ? (
          <p>No advisories returned for the resolved slice, or lookup was skipped.</p>
        ) : (
          <ul>
            {report.security.findings.map((f) => (
              <li key={`${f.advisoryId}-${f.packageName}`}>
                <span className="mono">
                  {f.packageName}@{f.version}
                </span>{' '}
                {f.severity} {f.advisoryId}: {f.summary}
              </li>
            ))}
          </ul>
        )}
      </article>

      <DependencyGraph report={report} />
      <RecommendationQueue items={report.alternatives} lowOverwhelm={lowOverwhelm} />

      <div className="header-actions">
        <button type="button" className="btn primary" onClick={onExport}>
          Export PR markdown
        </button>
        <button type="button" className="btn" onClick={onWorkflow}>
          Preview GitHub Action
        </button>
      </div>
    </div>
  );
}
