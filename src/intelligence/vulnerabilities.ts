import { z } from 'zod';
import { FETCH_TIMEOUT_MS, LOOKUP_MAX_PACKAGES } from '../models/constants';
import { cacheGet, cacheSet } from './cache';
import type { SecurityFinding } from '../schemas/report';
import type { NormalizedGraph } from '../graph/types';

/**
 * OSV is used as an advisory-compatible API because `npm audit` requires
 * executing npm against an uploaded tree, which this tool must never do.
 * Peer dependencies are not covered by npm audit; we keep that limitation visible.
 */
const OsvResponseSchema = z.object({
  vulns: z
    .array(
      z.object({
        id: z.string().min(1),
        summary: z.string().optional(),
        database_specific: z
          .object({
            severity: z.string().optional(),
          })
          .optional(),
        severity: z
          .array(z.object({ type: z.string(), score: z.string().optional() }))
          .optional(),
      }),
    )
    .optional(),
});

function mapSeverity(raw: string | undefined): SecurityFinding['severity'] {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('critical')) return 'critical';
  if (s.includes('high')) return 'high';
  if (s.includes('medium') || s.includes('moderate')) return 'medium';
  if (s.includes('low')) return 'low';
  return 'unknown';
}

async function queryOsv(name: string, version: string): Promise<SecurityFinding[]> {
  const key = `osv:${name}@${version}`;
  const cached = cacheGet<SecurityFinding[]>(key);
  if (cached) return cached;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch('https://api.osv.dev/v1/query', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        package: { name, ecosystem: 'npm' },
        version,
      }),
    });
    if (res.status === 429) throw new Error('OSV rate-limited this request.');
    if (!res.ok) throw new Error(`OSV returned HTTP ${res.status}.`);
    const json: unknown = await res.json();
    const parsed = OsvResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error('OSV payload failed schema validation and was discarded.');
    }
    const findings: SecurityFinding[] = (parsed.data.vulns ?? []).map((v) => ({
      packageName: name,
      version,
      severity: mapSeverity(v.database_specific?.severity ?? v.severity?.[0]?.type),
      advisoryId: v.id,
      summary: v.summary ?? 'Advisory recorded without a summary.',
      source: 'osv.dev',
    }));
    cacheSet(key, findings);
    return findings;
  } finally {
    clearTimeout(t);
  }
}

export type VulnLookup = {
  findings: SecurityFinding[];
  attempted: boolean;
  ok: boolean;
  error?: string;
  peerDepsUncovered: boolean;
};

export async function lookupVulnerabilities(graph: NormalizedGraph): Promise<VulnLookup> {
  if (graph.missingLockfile) {
    return {
      findings: [],
      attempted: false,
      ok: true,
      peerDepsUncovered: true,
      error: 'Vulnerability lookup skipped: no resolved lockfile tree.',
    };
  }
  const resolved = graph.nodes.filter((n) => n.version !== 'unresolved' && n.version !== 'unknown');
  const slice = resolved.slice(0, LOOKUP_MAX_PACKAGES);
  const findings: SecurityFinding[] = [];
  const errors: string[] = [];
  for (const node of slice) {
    try {
      findings.push(...(await queryOsv(node.name, node.version)));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'OSV lookup failed.');
    }
  }
  return {
    findings,
    attempted: true,
    ok: errors.length === 0,
    error: errors[0],
    peerDepsUncovered: true,
  };
}
