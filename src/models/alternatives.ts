import { TOOL_SOURCE_VERSION } from './constants';
import type { Confidence, Recommendation } from '../schemas/report';

export type AlternativeSignal = {
  name: string;
  version?: string;
  reasons: Array<
    | 'duplicate-capability'
    | 'known-smaller-modular-alt'
    | 'obsolete'
    | 'unused-declared'
    | 'measured-bundle-contributor'
  >;
  evidence: string[];
  suggestedAlt?: string;
  securitySensitive?: boolean;
  frameworkBound?: boolean;
  compatibilityCritical?: boolean;
};

export type AlternativesInput = {
  signals: AlternativeSignal[];
  hasBundleArtifact: boolean;
  hasLockfile: boolean;
};

const SENSITIVE = new Set(['crypto', 'jsonwebtoken', 'bcrypt', 'argon2', 'helmet', 'cors']);

function risk(signal: AlternativeSignal): Recommendation['migrationRisk'] {
  if (signal.securitySensitive || signal.frameworkBound || signal.compatibilityCritical) return 'high';
  if (signal.reasons.includes('measured-bundle-contributor')) return 'medium';
  return 'low';
}

function confidence(signal: AlternativeSignal, hasArtifact: boolean): Confidence {
  if (signal.reasons.includes('measured-bundle-contributor') && hasArtifact) return 'high';
  if (signal.reasons.includes('unused-declared') && signal.evidence.length > 0) return 'medium';
  if (signal.reasons.includes('duplicate-capability')) return 'medium';
  return 'low';
}

function category(signal: AlternativeSignal, hasArtifact: boolean): Recommendation['category'] {
  if (signal.securitySensitive || signal.frameworkBound || signal.compatibilityCritical) {
    return 'measure-first';
  }
  if (!hasArtifact && !signal.reasons.includes('unused-declared')) return 'measure-first';
  if (signal.reasons.includes('unused-declared') || signal.reasons.includes('obsolete')) return 'remove';
  if (signal.reasons.includes('known-smaller-modular-alt') || signal.reasons.includes('duplicate-capability')) {
    return 'replace';
  }
  if (signal.reasons.includes('measured-bundle-contributor')) return 'defer';
  return 'measure-first';
}

export function proposeAlternatives(input: AlternativesInput): Recommendation[] {
  const out: Recommendation[] = [];

  if (!input.hasBundleArtifact) {
    out.push({
      id: 'measure-first-default',
      title: 'Measure shipped modules before swapping packages',
      category: 'measure-first',
      confidence: 'unmeasured',
      migrationRisk: 'low',
      evidence: [
        'No production bundle artifact, source map, or bundler metafile was supplied.',
        'Package metadata is not a build measurement.',
      ],
      action:
        'Add a bundler stats file or CI size-limit job. Treat current package-level advisories as a candidate list only.',
    });
  }

  if (!input.hasLockfile) {
    out.push({
      id: 'add-lockfile',
      title: 'Commit a lockfile so versions and duplicates can be resolved',
      category: 'measure-first',
      confidence: 'low',
      migrationRisk: 'low',
      evidence: ['A lockfile was not present, so transitive versions and installed instances are unmeasured.'],
      action: 'Generate and commit the package-manager lockfile, then re-run this analysis.',
    });
  }

  for (const signal of input.signals) {
    const sensitive =
      signal.securitySensitive ||
      signal.frameworkBound ||
      signal.compatibilityCritical ||
      SENSITIVE.has(signal.name);
    const cat = category({ ...signal, securitySensitive: sensitive }, input.hasBundleArtifact);
    const alt =
      sensitive && signal.suggestedAlt
        ? `${signal.suggestedAlt} may overlap, but this package looks security-sensitive, framework-bound, or compatibility-critical. Record API and migration tradeoffs before replacing it.`
        : signal.suggestedAlt
          ? `If evidence still holds after a measured build, evaluate ${signal.suggestedAlt} as a potential optimization opportunity.`
          : 'Keep the package until a measured artifact shows it contributes to shipped JS or unused-declared evidence is confirmed.';

    out.push({
      id: `alt-${signal.name}`,
      title: `${signal.name}: ${cat === 'measure-first' ? 'measure before changing' : cat}`,
      category: cat,
      confidence: confidence(signal, input.hasBundleArtifact),
      migrationRisk: risk({ ...signal, securitySensitive: sensitive }),
      evidence: signal.evidence.length > 0 ? signal.evidence : [`Signal: ${signal.reasons.join(', ')}`],
      packageName: signal.name,
      action: alt,
    });
  }

  return out.map((r) => ({
    ...r,
    evidence: [...r.evidence, `sourceVersion ${TOOL_SOURCE_VERSION}`],
  }));
}
