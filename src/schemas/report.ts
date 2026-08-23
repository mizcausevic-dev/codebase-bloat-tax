import { z } from 'zod';

/**
 * Exact contract for every estimate this tool emits.
 * Reject malformed/partial third-party payloads. Do not coerce optimistic values.
 */

export const ConfidenceSchema = z.enum([
  'measured',
  'high',
  'medium',
  'low',
  'unmeasured',
]);

export type Confidence = z.infer<typeof ConfidenceSchema>;

export const RangeSchema = z
  .object({
    min: z.number().finite(),
    max: z.number().finite(),
  })
  .refine((r) => r.max >= r.min, { message: 'range.max must be >= range.min' });

export const EstimateSchema = z.object({
  value: z.number().finite().nullable(),
  range: RangeSchema.optional(),
  unit: z.string().min(1),
  confidence: ConfidenceSchema,
  method: z.string().min(1),
  assumptions: z.array(z.string().min(1)).min(1),
  sourceVersion: z.string().min(1),
});

export type Estimate = z.infer<typeof EstimateSchema>;

export const EvidenceTierSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const SourceKindSchema = z.enum([
  'upload',
  'github-public',
  'github-private',
  'snippet',
  'screenshot',
  'demo',
]);

export const FileRoleSchema = z.enum([
  'package-json',
  'npm-lock',
  'pnpm-lock',
  'yarn-lock',
  'bundler-stats',
  'vite-visualizer',
  'esbuild-metafile',
  'source-map',
  'lighthouse',
  'chrome-trace',
  'ci-timestamps',
  'import-snippet',
  'screenshot',
  'unknown',
]);

export const InputFileSchema = z.object({
  name: z.string().min(1),
  role: FileRoleSchema,
  bytes: z.number().int().nonnegative(),
});

export const DuplicateGroupSchema = z.object({
  name: z.string().min(1),
  versions: z.array(z.string().min(1)).min(1),
  instanceCount: z.number().int().positive(),
});

export const GraphNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  integrity: z.string().nullable(),
  dependencyType: z.enum([
    'prod',
    'dev',
    'optional',
    'peer',
    'peerOptional',
    'unknown',
  ]),
  direct: z.boolean(),
  parentPaths: z.array(z.string()),
});

export const GraphEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  kind: z.enum(['prod', 'dev', 'optional', 'peer', 'peerOptional', 'unknown']),
});

export const RecommendationCategorySchema = z.enum([
  'remove',
  'replace',
  'defer',
  'measure-first',
]);

export const MigrationRiskSchema = z.enum(['low', 'medium', 'high']);

export const RecommendationSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  category: RecommendationCategorySchema,
  confidence: ConfidenceSchema,
  migrationRisk: MigrationRiskSchema,
  evidence: z.array(z.string().min(1)).min(1),
  packageName: z.string().optional(),
  action: z.string().min(1),
});

export const SecurityFindingSchema = z.object({
  packageName: z.string().min(1),
  version: z.string().min(1),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'unknown']),
  advisoryId: z.string().min(1),
  summary: z.string().min(1),
  source: z.string().min(1),
});

export const LookupStatusSchema = z.object({
  attempted: z.boolean(),
  ok: z.boolean(),
  error: z.string().optional(),
  cached: z.boolean().optional(),
});

export const CodebaseBloatReportSchema = z.object({
  generatedAt: z.string().datetime(),
  sourceVersion: z.string().min(1),
  disclaimer:
    z.literal(
      'This tool estimates dependency and delivery costs. It does not prove causality, measure real-user performance without field data, or guarantee that time-value estimates convert to recovered payroll.',
    ),
  inputs: z.object({
    sourceKind: SourceKindSchema,
    repository: z
      .object({
        owner: z.string().min(1),
        name: z.string().min(1),
        ref: z.string().min(1),
        public: z.boolean(),
      })
      .optional(),
    files: z.array(InputFileSchema),
    hasLockfile: z.boolean(),
    hasBundleArtifact: z.boolean(),
    hasCiTimestamps: z.boolean(),
    hasMobileArtifact: z.boolean(),
  }),
  evidenceQuality: z.object({
    strongestTier: EvidenceTierSchema,
    notes: z.array(z.string().min(1)),
  }),
  graph: z.object({
    uniquePackages: z.number().int().nonnegative(),
    installedInstances: z.number().int().nonnegative(),
    directCount: z.number().int().nonnegative(),
    transitiveCount: z.number().int().nonnegative(),
    duplicateGroups: z.array(DuplicateGroupSchema),
    missingLockfile: z.boolean(),
    nodes: z.array(GraphNodeSchema),
    edges: z.array(GraphEdgeSchema),
    manager: z.enum(['npm', 'pnpm', 'yarn-classic', 'yarn-berry', 'unknown']),
    lockfileVersion: z.string().nullable(),
  }),
  bundle: EstimateSchema.extend({
    kind: z.enum(['measured-artifact', 'potential-package-footprint', 'unmeasured']),
    entries: z.array(
      z.object({
        label: z.string(),
        initialBytes: z.number().nonnegative().nullable(),
        lazyBytes: z.number().nonnegative().nullable(),
        serverOnlyBytes: z.number().nonnegative().nullable(),
      }),
    ),
    transfer: z.object({
      gzipMs: EstimateSchema,
      brotliMs: EstimateSchema,
      profileId: z.string(),
    }),
    doNotSumGzipInvariant: z.literal(true),
  }),
  mobile: EstimateSchema.extend({
    modeled: z.boolean(),
    limitation:
      z.literal(
        'Chrome DevTools CPU throttling does not fully simulate mobile disk, memory bandwidth, thermal, GPU, device variance, or field network.',
      ),
  }),
  buildWait: EstimateSchema.extend({
    mode: z.enum(['measured', 'estimated']),
    percentiles: z
      .object({
        p50: z.number().nonnegative().nullable(),
        p75: z.number().nonnegative().nullable(),
        p95: z.number().nonnegative().nullable(),
      })
      .optional(),
    queueMinutes: z.number().nonnegative().nullable().optional(),
    runnerMinutes: z.number().nonnegative().nullable().optional(),
    blockingMinutes: z.number().nonnegative().nullable().optional(),
  }),
  opportunityCost: EstimateSchema.extend({
    annualBlockingHours: EstimateSchema,
    inputsUsed: z.object({
      teamSize: z.number(),
      runsPerWeek: z.number(),
      weeksPerYear: z.number(),
      blockingMinutesPerRun: z.number(),
      affectedDevelopers: z.number(),
      hourlyCost: z.number(),
      defaultsWereUsed: z.boolean(),
    }),
  }),
  alternatives: z.array(RecommendationSchema),
  security: z.object({
    findings: z.array(SecurityFindingSchema),
    peerDepsUncovered: z.boolean(),
    distinctFromPerformance: z.literal(true),
    note: z.string().min(1),
  }),
  lookups: z.object({
    bundlephobia: LookupStatusSchema,
    npmRegistry: LookupStatusSchema,
    vulnerabilities: LookupStatusSchema,
  }),
});

export type CodebaseBloatReport = z.infer<typeof CodebaseBloatReportSchema>;
export type Recommendation = z.infer<typeof RecommendationSchema>;
export type SecurityFinding = z.infer<typeof SecurityFindingSchema>;
export type FileRole = z.infer<typeof FileRoleSchema>;
