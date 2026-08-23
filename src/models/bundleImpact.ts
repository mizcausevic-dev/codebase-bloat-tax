import {
  BROTLI_VS_GZIP_RATIO,
  BROTLI_VS_GZIP_RATIO_MAX,
  BROTLI_VS_GZIP_RATIO_MIN,
  DEFAULT_NETWORK_PROFILE,
  NETWORK_PROFILES,
  TOOL_SOURCE_VERSION,
  type NetworkProfileId,
} from './constants';
import { EstimateSchema, type Estimate } from '../schemas/report';

export type BundleModule = {
  id: string;
  bytes: number;
  gzipBytes?: number;
  brotliBytes?: number;
  kind: 'initial' | 'lazy' | 'server-only';
  entry?: string;
};

export type BundleArtifact = {
  modules: BundleModule[];
};

export type BundlephobiaAdvisory = {
  name: string;
  version: string;
  gzip: number;
  size: number;
};

export type BundleImpactInput = {
  artifact?: BundleArtifact;
  advisories?: BundlephobiaAdvisory[];
  networkProfileId?: NetworkProfileId;
};

export type TransferSplit = {
  gzipMs: Estimate;
  brotliMs: Estimate;
  profileId: NetworkProfileId;
};

export type BundleImpactResult = Estimate & {
  kind: 'measured-artifact' | 'potential-package-footprint' | 'unmeasured';
  entries: Array<{
    label: string;
    initialBytes: number | null;
    lazyBytes: number | null;
    serverOnlyBytes: number | null;
  }>;
  transfer: TransferSplit;
  doNotSumGzipInvariant: true;
};

/**
 * transferTimeMs = compressedBytes / effectiveThroughputBytesPerMs + RTT overhead
 * Encoding labels stay honest: gzip is never called uncompressed.
 */
export function transferTimeMs(
  compressedBytes: number,
  profileId: NetworkProfileId = DEFAULT_NETWORK_PROFILE,
): number {
  const profile = NETWORK_PROFILES[profileId];
  return compressedBytes / profile.effectiveThroughputBytesPerMs + profile.rttOverheadMs;
}

function estimateOf(partial: Estimate): Estimate {
  return EstimateSchema.parse(partial);
}

function transferEstimate(
  bytes: number | null,
  unitLabel: 'gzip-ms' | 'brotli-ms',
  profileId: NetworkProfileId,
  confidence: Estimate['confidence'],
  method: string,
  extraAssumptions: string[],
): Estimate {
  const profile = NETWORK_PROFILES[profileId];
  return estimateOf({
    value: bytes === null ? null : transferTimeMs(bytes, profileId),
    range:
      bytes === null
        ? undefined
        : {
            min: transferTimeMs(bytes * 0.9, profileId),
            max: transferTimeMs(bytes * 1.1, profileId),
          },
    unit: unitLabel,
    confidence,
    method,
    assumptions: [
      `Network profile ${profile.label}: ${profile.effectiveThroughputBytesPerMs} B/ms effective throughput, ${profile.rttOverheadMs} ms RTT overhead.`,
      'Transfer time is not parse/compile time.',
      ...extraAssumptions,
    ],
    sourceVersion: TOOL_SOURCE_VERSION,
  });
}

export function assessBundleImpact(input: BundleImpactInput): BundleImpactResult {
  const profileId = input.networkProfileId ?? DEFAULT_NETWORK_PROFILE;

  if (input.artifact && input.artifact.modules.length > 0) {
    const initial = input.artifact.modules.filter((m) => m.kind === 'initial');
    const initialBytes = initial.reduce((s, m) => s + m.bytes, 0);
    const gzip =
      initial.reduce((s, m) => s + (m.gzipBytes ?? 0), 0) ||
      null;
    const brotliMeasured = initial.reduce((s, m) => s + (m.brotliBytes ?? 0), 0);
    const brotli =
      brotliMeasured ||
      (gzip !== null ? Math.round(gzip * BROTLI_VS_GZIP_RATIO) : null);

    const byEntry = new Map<string, { initial: number; lazy: number; server: number }>();
    for (const m of input.artifact.modules) {
      const key = m.entry ?? 'unknown-entry';
      const cur = byEntry.get(key) ?? { initial: 0, lazy: 0, server: 0 };
      if (m.kind === 'initial') cur.initial += m.bytes;
      else if (m.kind === 'lazy') cur.lazy += m.bytes;
      else cur.server += m.bytes;
      byEntry.set(key, cur);
    }

    return {
      ...estimateOf({
        value: initialBytes,
        unit: 'bytes-uncompressed-initial',
        confidence: 'measured',
        method: 'Sum of initial-load modules from a project bundler artifact or metafile.',
        assumptions: [
          'Byte values come from a project-specific artifact, not package-registry marketing.',
          'Server-only modules are excluded from transfer time.',
        ],
        sourceVersion: TOOL_SOURCE_VERSION,
      }),
      kind: 'measured-artifact',
      entries: [...byEntry.entries()].map(([label, v]) => ({
        label,
        initialBytes: v.initial,
        lazyBytes: v.lazy,
        serverOnlyBytes: v.server,
      })),
      transfer: {
        gzipMs: transferEstimate(
          gzip,
          'gzip-ms',
          profileId,
          gzip === null ? 'low' : 'high',
          gzip === null
            ? 'Initial uncompressed bytes present; gzip missing so transfer is uncomputed.'
            : 'Measured gzip bytes on initial modules plus configured network profile.',
          gzip === null ? ['Gzip bytes were not present on the artifact.'] : [],
        ),
        brotliMs: transferEstimate(
          brotli,
          'brotli-ms',
          profileId,
          brotliMeasured ? 'high' : gzip !== null ? 'medium' : 'low',
          brotliMeasured
            ? 'Measured Brotli bytes on initial modules.'
            : 'Brotli inferred from gzip using BROTLI_VS_GZIP_RATIO.',
          brotliMeasured
            ? []
            : [
                `Brotli modeled at ${BROTLI_VS_GZIP_RATIO} of gzip (range ${BROTLI_VS_GZIP_RATIO_MIN}-${BROTLI_VS_GZIP_RATIO_MAX}).`,
              ],
        ),
        profileId,
      },
      doNotSumGzipInvariant: true,
      range: undefined,
    };
  }

  if (input.advisories && input.advisories.length > 0) {
    // INVARIANT: never sum every package gzip into "your bundle size".
    // Report the single largest advisory footprint as a potential package cost,
    // plus a labeled list. Summing would treat disjoint packages as one payload.
    const largest = [...input.advisories].sort((a, b) => b.gzip - a.gzip)[0];
    return {
      ...estimateOf({
        value: largest.gzip,
        range: {
          min: largest.gzip,
          max: largest.gzip,
        },
        unit: 'bytes-gzip-advisory-single-package',
        confidence: 'low',
        method:
          'Bundlephobia advisory for individual packages. The value is the largest single-package min+gzip, not an application bundle.',
        assumptions: [
          'Bundlephobia measures a package published to npm, not your bundler output.',
          'Tree-shaking, dual packages, and shared chunks are unmeasured.',
          'Gzip figures from other packages are listed separately and MUST NOT be summed.',
        ],
        sourceVersion: TOOL_SOURCE_VERSION,
      }),
      kind: 'potential-package-footprint',
      entries: input.advisories.map((a) => ({
        label: `${a.name}@${a.version} (advisory only)`,
        initialBytes: a.size,
        lazyBytes: null,
        serverOnlyBytes: null,
      })),
      transfer: {
        gzipMs: transferEstimate(
          largest.gzip,
          'gzip-ms',
          profileId,
          'low',
          'Transfer time for the single largest advisory package gzip, not the app.',
          ['Do not add other advisory gzip values to this transfer time.'],
        ),
        brotliMs: transferEstimate(
          Math.round(largest.gzip * BROTLI_VS_GZIP_RATIO),
          'brotli-ms',
          profileId,
          'low',
          'Brotli inferred from the single largest advisory gzip.',
          [
            `Brotli modeled at ${BROTLI_VS_GZIP_RATIO} of gzip.`,
            'Still a single-package advisory, not an app bundle.',
          ],
        ),
        profileId,
      },
      doNotSumGzipInvariant: true,
    };
  }

  return {
    ...estimateOf({
      value: null,
      unit: 'bytes',
      confidence: 'unmeasured',
      method: 'No bundler artifact and no advisory package sizes were supplied.',
      assumptions: [
        'Package count is not shipped JavaScript.',
        'Upload a stats.json, Vite/Rollup visualizer, esbuild metafile, or source map to measure contribution.',
      ],
      sourceVersion: TOOL_SOURCE_VERSION,
    }),
    kind: 'unmeasured',
    entries: [],
    transfer: {
      gzipMs: transferEstimate(null, 'gzip-ms', profileId, 'unmeasured', 'No compressed bytes.', [
        'Missing artifact.',
      ]),
      brotliMs: transferEstimate(null, 'brotli-ms', profileId, 'unmeasured', 'No compressed bytes.', [
        'Missing artifact.',
      ]),
      profileId,
    },
    doNotSumGzipInvariant: true,
  };
}

/** Test helper: summing advisory gzip values is forbidden as a bundle total. */
export function assertDoNotSumGzip(advisories: BundlephobiaAdvisory[]): number {
  if (advisories.length === 0) return 0;
  const result = assessBundleImpact({ advisories });
  const sum = advisories.reduce((s, a) => s + a.gzip, 0);
  if (advisories.length > 1 && result.value === sum) {
    throw new Error('Invariant violated: advisory gzip values were summed into the headline value.');
  }
  return result.value ?? 0;
}
