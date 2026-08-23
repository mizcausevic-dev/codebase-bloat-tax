import type { CodebaseBloatReport } from '../../schemas/report';

type Props = { report: CodebaseBloatReport };

export function DependencyGraph({ report }: Props) {
  const nodes = report.graph.nodes.slice(0, 24);
  const width = 720;
  const height = 260;
  const cols = 6;
  return (
    <article className="glass card">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0 }}>Resolved graph</h3>
        <span className={`badge ${report.graph.missingLockfile ? 'low' : 'high'}`}>
          {report.graph.missingLockfile ? 'low (no lockfile)' : report.graph.manager}
        </span>
      </div>
      <p className="muted">
        Unique packages {report.graph.uniquePackages}. Installed instances {report.graph.installedInstances}. Direct{' '}
        {report.graph.directCount}. Transitive {report.graph.transitiveCount}.
      </p>
      <svg className="graph-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Dependency nodes">
        {nodes.map((n, i) => {
          const x = 40 + (i % cols) * 115;
          const y = 36 + Math.floor(i / cols) * 58;
          return (
            <g key={n.id}>
              <circle cx={x} cy={y} r={10} fill={n.direct ? 'var(--accent)' : 'var(--accent2)'} />
              <text x={x + 16} y={y + 4} fill="var(--text)" fontSize="10" fontFamily="var(--fontMono)">
                {n.name.slice(0, 16)}
              </text>
            </g>
          );
        })}
      </svg>
      {report.graph.duplicateGroups.length > 0 ? (
        <div>
          <h4>Duplicate versions</h4>
          <ul>
            {report.graph.duplicateGroups.map((g) => (
              <li key={g.name} className="mono">
                {g.name}: {g.versions.join(', ')} ({g.instanceCount} instances)
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">No duplicate resolved versions in the visible graph.</p>
      )}
    </article>
  );
}
