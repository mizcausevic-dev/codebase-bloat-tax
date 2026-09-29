import { CodebaseBloatReportSchema, type CodebaseBloatReport } from '../schemas/report';
import { DISCLAIMER, TOOL_SOURCE_VERSION, type NetworkProfileId } from '../models/constants';
import { assessBundleImpact } from '../models/bundleImpact';
import { assessMobileCost } from '../models/mobileCost';
import { assessBuildWait } from '../models/buildWait';
import { assessOpportunityCost, type OpportunityCostInput } from '../models/opportunityCost';
import { proposeAlternatives, type AlternativeSignal } from '../models/alternatives';
import { graphToReportShape, normalizeGraph } from '../graph/normalize';
import { collectManifests, type IngestedFile } from '../ingestion/manifests';
import { lookupBundlephobia } from '../intelligence/bundlephobia';
import { lookupNpmRegistry } from '../intelligence/npmRegistry';
import { lookupVulnerabilities } from '../intelligence/vulnerabilities';
import { parseBundleArtifact, parseCiTimestamps, parseLighthouse } from './artifacts';
import type { SourceKindSchema } from '../schemas/report';
import type { z } from 'zod';

export type AnalysisConfig = {
  networkProfileId: NetworkProfileId;
  mobileSlowdown: number;
  opportunity: OpportunityCostInput;
  enableLookups: boolean;
};

export type AnalysisRequest = {
  sourceKind: z.infer<typeof SourceKindSchema>;
  files: IngestedFile[];
  snippetPackages?: string[];
  repository?: { owner: string; name: string; ref: string; public: boolean };
  config: AnalysisConfig;
};

function strongestTier(input: {
  hasBundle: boolean;
  hasCi: boolean;
  hasLock: boolean;
  hasPkg: boolean;
  snippetOnly: boolean;
}): 1 | 2 | 3 | 4 | 5 {
  if (input.hasBundle) return 1;
  if (input.hasCi) return 2;
  if (input.hasLock) return 3;
  if (input.hasPkg) return 4;
  return 5;
}

export async function runAnalysis(req: AnalysisRequest): Promise<CodebaseBloatReport> {
  const manifests = collectManifests(req.files);
  const graph = await normalizeGraph({
    packageJson: manifests.packageJson,
    npmLock: manifests.npmLock,
    pnpmLock: manifests.pnpmLock,
    yarnLock: manifests.yarnLock,
  });

  const artifact = parseBundleArtifact(manifests.bundlerStats, manifests.metafile);
  const lighthouse = parseLighthouse(manifests.lighthouse);
  const ciSamples = parseCiTimestamps(manifests.ciTimestamps);

  const snippetOnly = Boolean(req.snippetPackages?.length) && !manifests.packageJson && graph.missingLockfile;
  if (snippetOnly && req.snippetPackages) {
    for (const name of req.snippetPackages) {
      if (!graph.nodes.some((n) => n.name === name)) {
        graph.nodes.push({
          id: `${name}@candidate`,
          name,
          version: 'unresolved',
          integrity: null,
          dependencyType: 'unknown',
          direct: true,
          parentPaths: ['import-snippet'],
        });
      }
    }
    graph.uniquePackages = new Set(graph.nodes.map((n) => n.name)).size;
    graph.installedInstances = graph.nodes.length;
    graph.directCount = graph.nodes.filter((n) => n.direct).length;
    graph.transitiveCount = graph.nodes.filter((n) => !n.direct).length;
  }

  const lookupPkgs = graph.nodes
    .filter((n) => n.direct)
    .slice(0, 12)
    .map((n) => ({
      name: n.name,
      version: n.version !== 'unresolved' && n.version !== 'unknown' ? n.version : undefined,
    }));

  const [bp, npm, vulns] = req.config.enableLookups
    ? await Promise.all([
        lookupBundlephobia(lookupPkgs),
        lookupNpmRegistry(lookupPkgs.map((p) => p.name)),
        lookupVulnerabilities(graph),
      ])
    : [
        { advisories: [], attempted: false, ok: true },
        { packages: [], attempted: false, ok: true },
        { findings: [], attempted: false, ok: true, peerDepsUncovered: true },
      ];

  const bundle = assessBundleImpact({
    artifact,
    advisories: bp.advisories,
    networkProfileId: req.config.networkProfileId,
  });
  const mobile = assessMobileCost({
    artifact: lighthouse,
    slowdown: req.config.mobileSlowdown,
  });
  const lockfileBytes = req.files
    .filter((f) => f.role === 'npm-lock' || f.role === 'pnpm-lock' || f.role === 'yarn-lock')
    .reduce((s, f) => s + f.bytes, 0);
  const nativeHints = graph.nodes.filter((n) =>
    /native|sqlite|bcrypt|sharp|esbuild|swc/i.test(n.name),
  ).length;
  const buildWait = assessBuildWait({
    samples: ciSamples,
    signals: {
      uniquePackages: graph.uniquePackages,
      lockfileBytes,
      duplicateGroups: graph.duplicateGroups.length,
      optionalNativeHints: nativeHints,
      ciCacheLikely: false,
    },
  });
  const opportunityCost = assessOpportunityCost({
    ...req.config.opportunity,
    blockingMinutesPerRun:
      req.config.opportunity.blockingMinutesPerRun ?? buildWait.blockingMinutes ?? undefined,
  });

  const signals: AlternativeSignal[] = [];
  const byName = new Map<string, string[]>();
  for (const n of graph.nodes) {
    const list = byName.get(n.name) ?? [];
    if (!list.includes(n.version)) list.push(n.version);
    byName.set(n.name, list);
  }
  for (const [name, versions] of byName) {
    if (versions.length > 1) {
      signals.push({
        name,
        reasons: ['duplicate-capability'],
        evidence: [`Resolved versions: ${versions.join(', ')}`],
      });
    }
  }
  if (graph.nodes.some((n) => n.name === 'moment')) {
    signals.push({
      name: 'moment',
      reasons: ['known-smaller-modular-alt', 'obsolete'],
      evidence: ['moment is in maintenance mode on npm. This is not a measured bundle contribution unless an artifact is attached.'],
      suggestedAlt: 'date-fns or Temporal',
    });
  }
  if (graph.nodes.some((n) => n.name === 'lodash') && graph.nodes.some((n) => n.name === 'lodash-es')) {
    signals.push({
      name: 'lodash',
      reasons: ['duplicate-capability'],
      evidence: ['Both lodash and lodash-es are declared or resolved.'],
      suggestedAlt: 'keep one implementation after measuring shipped modules',
    });
  }

  const alternatives = proposeAlternatives({
    signals,
    hasBundleArtifact: Boolean(artifact),
    hasLockfile: !graph.missingLockfile,
  });

  const hasPkg = Boolean(manifests.packageJson);
  const report = {
    generatedAt: new Date().toISOString(),
    sourceVersion: TOOL_SOURCE_VERSION,
    disclaimer: DISCLAIMER,
    inputs: {
      sourceKind: req.sourceKind,
      repository: req.repository,
      files: req.files.map((f) => ({ name: f.name, role: f.role, bytes: f.bytes })),
      hasLockfile: !graph.missingLockfile,
      hasBundleArtifact: Boolean(artifact),
      hasCiTimestamps: Boolean(ciSamples),
      hasMobileArtifact: Boolean(lighthouse),
    },
    evidenceQuality: {
      strongestTier: strongestTier({
        hasBundle: Boolean(artifact),
        hasCi: Boolean(ciSamples),
        hasLock: !graph.missingLockfile,
        hasPkg,
        snippetOnly,
      }),
      notes: [
        artifact
          ? 'Strongest evidence is a project bundler artifact.'
          : 'No bundler artifact. Bundle figures are advisory or unmeasured.',
        graph.missingLockfile
          ? 'Lockfile missing. Graph confidence is low and vulnerability lookup is skipped or incomplete.'
          : `Lockfile resolved via ${graph.manager}. Unique packages ${graph.uniquePackages}, installed instances ${graph.installedInstances}.`,
        snippetOnly
          ? 'Snippet or screenshot inventory cannot resolve versions, transitive deps, installed size, or shipped bundle cost.'
          : 'Declared and/or resolved packages were available.',
      ],
    },
    graph: graphToReportShape(graph),
    bundle,
    mobile,
    buildWait,
    opportunityCost,
    alternatives,
    security: {
      findings: vulns.findings,
      peerDepsUncovered: true,
      distinctFromPerformance: true as const,
      note: 'Security findings are not performance recommendations. npm audit-style lookups do not cover peer dependencies. OSV is used because npm audit would require executing npm against an uploaded tree.',
    },
    lookups: {
      bundlephobia: {
        attempted: bp.attempted,
        ok: bp.ok,
        error: 'error' in bp ? bp.error : undefined,
        cached: 'cached' in bp ? bp.cached : undefined,
      },
      npmRegistry: {
        attempted: npm.attempted,
        ok: npm.ok,
        error: 'error' in npm ? npm.error : undefined,
        cached: 'cached' in npm ? npm.cached : undefined,
      },
      vulnerabilities: {
        attempted: vulns.attempted,
        ok: vulns.ok,
        error: vulns.error,
      },
    },
  };

  return CodebaseBloatReportSchema.parse(report);
}
