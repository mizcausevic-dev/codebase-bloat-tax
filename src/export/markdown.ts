import type { CodebaseBloatReport } from '../schemas/report';

const SECRET_RE =
  /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,})/g;
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const ABS_PATH_RE = /(?:[A-Za-z]:\\|\/Users\/|\/home\/)[^\s)]+/g;

export type MarkdownExportOptions = {
  includePackageNames?: boolean;
};

export function redactSecrets(text: string): string {
  return text
    .replace(SECRET_RE, '[redacted-secret]')
    .replace(EMAIL_RE, '[redacted-email]')
    .replace(ABS_PATH_RE, '[redacted-path]');
}

function displayName(name: string | undefined, include: boolean): string {
  if (!name) return 'a package';
  if (include) return name;
  return 'a private or opted-out package';
}

export function exportMarkdown(
  report: CodebaseBloatReport,
  options: MarkdownExportOptions = {},
): string {
  const includeNames = options.includePackageNames ?? report.inputs.sourceKind !== 'github-private';
  const findings = report.alternatives.slice(0, 3);
  const lines: string[] = [
    '# Codebase delivery-cost note',
    '',
    '> Non-blocking observation. This is decision support, not a verdict.',
    '',
    report.disclaimer,
    '',
    '## Inputs and evidence quality',
    '',
    `- Source: ${report.inputs.sourceKind}`,
    `- Lockfile present: ${report.inputs.hasLockfile ? 'yes' : 'no'}`,
    `- Bundle artifact present: ${report.inputs.hasBundleArtifact ? 'yes' : 'no'}`,
    `- CI timestamps present: ${report.inputs.hasCiTimestamps ? 'yes' : 'no'}`,
    `- Mobile artifact present: ${report.inputs.hasMobileArtifact ? 'yes' : 'no'}`,
    `- Strongest evidence tier: ${report.evidenceQuality.strongestTier} (1 = measured artifact, 5 = snippet/screenshot)`,
    ...report.evidenceQuality.notes.map((n) => `- ${n}`),
    '',
    '## Top 3 findings',
    '',
  ];

  if (findings.length === 0) {
    lines.push('No recommendation queue items were generated.');
  }

  findings.forEach((item, i) => {
    lines.push(`### ${i + 1}. ${includeNames ? item.title : item.category}`);
    lines.push('');
    lines.push(`- Metric / action: ${item.action}`);
    lines.push(`- Source: ${item.evidence[0] ?? 'see evidence list'}`);
    lines.push(`- Confidence: ${item.confidence}`);
    lines.push(`- Assumptions: ${item.evidence.slice(1).join('; ') || 'see card'}`);
    lines.push(`- Category: ${item.category} (migration risk ${item.migrationRisk})`);
    if (item.packageName) {
      lines.push(`- Package: ${displayName(item.packageName, includeNames)}`);
    }
    lines.push('');
  });

  lines.push('## Measured vs heuristic');
  lines.push('');
  lines.push(
    `- Bundle: ${report.bundle.kind} (${report.bundle.confidence}). ${report.bundle.method}`,
  );
  lines.push(`- Build wait: ${report.buildWait.mode} (${report.buildWait.confidence}). ${report.buildWait.method}`);
  lines.push(`- Mobile: ${report.mobile.modeled ? 'modeled' : 'artifact or unmeasured'} (${report.mobile.confidence}).`);
  lines.push(
    `- Opportunity cost: ${report.opportunityCost.inputsUsed.defaultsWereUsed ? 'includes labeled defaults' : 'operator inputs'} (${report.opportunityCost.confidence}).`,
  );
  lines.push('');
  lines.push('Security advisories are listed separately from performance recommendations.');
  lines.push(`Advisory count: ${report.security.findings.length}. Peer dependencies are not covered by npm audit-style lookups.`);
  lines.push('');
  lines.push('Do not treat this note as proof that waiting time is payroll waste.');

  return redactSecrets(lines.join('\n'));
}
