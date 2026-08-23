import {
  ESTIMATED_BUILD_BASE_MINUTES,
  ESTIMATED_BUILD_MINUTES_PER_DUPLICATE_GROUP,
  ESTIMATED_INSTALL_MINUTES_PER_100_PACKAGES,
  ESTIMATED_NATIVE_MODULE_MINUTES,
  ESTIMATED_WAIT_MAX_MINUTES,
  ESTIMATED_WAIT_MIN_MINUTES,
  TOOL_SOURCE_VERSION,
} from './constants';
import { EstimateSchema, type Estimate } from '../schemas/report';

export type CiJobSample = {
  installMinutes?: number;
  buildMinutes?: number;
  testMinutes?: number;
  queueMinutes?: number;
  runnerMinutes?: number;
  totalMinutes: number;
};

export type BuildWaitGraphSignals = {
  uniquePackages: number;
  lockfileBytes: number;
  duplicateGroups: number;
  optionalNativeHints: number;
  ciCacheLikely: boolean;
};

export type BuildWaitInput = {
  samples?: CiJobSample[];
  signals?: BuildWaitGraphSignals;
};

export type BuildWaitResult = Estimate & {
  mode: 'measured' | 'estimated';
  percentiles?: { p50: number | null; p75: number | null; p95: number | null };
  queueMinutes?: number | null;
  runnerMinutes?: number | null;
  blockingMinutes?: number | null;
};

function percentile(sorted: number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
}

export function assessBuildWait(input: BuildWaitInput): BuildWaitResult {
  if (input.samples && input.samples.length > 0) {
    const totals = input.samples.map((s) => s.totalMinutes).sort((a, b) => a - b);
    const queues = input.samples.map((s) => s.queueMinutes).filter((n): n is number => typeof n === 'number');
    const runners = input.samples.map((s) => s.runnerMinutes).filter((n): n is number => typeof n === 'number');
    const p50 = percentile(totals, 50);
    const p75 = percentile(totals, 75);
    const p95 = percentile(totals, 95);
    const medQueue = median(queues);
    const medRunner = median(runners);
    return {
      ...EstimateSchema.parse({
        value: p50,
        range: p95 !== null && p50 !== null ? { min: p50, max: p95 } : undefined,
        unit: 'minutes-total-queued-plus-run',
        confidence: input.samples.length >= 8 ? 'high' : 'medium',
        method: `Observed GitHub Actions job timestamps across ${input.samples.length} run(s). Percentiles are sample percentiles, not a SLA.`,
        assumptions: [
          'Queue time, runner execution, and developer-blocking time are reported separately when present.',
          'Workflow file names and secrets are not retained.',
        ],
        sourceVersion: TOOL_SOURCE_VERSION,
      }),
      mode: 'measured',
      percentiles: { p50, p75, p95 },
      queueMinutes: medQueue,
      runnerMinutes: medRunner,
      blockingMinutes: medRunner,
    };
  }

  const s = input.signals;
  if (!s) {
    return {
      ...EstimateSchema.parse({
        value: null,
        unit: 'minutes',
        confidence: 'unmeasured',
        method: 'No CI timestamps and no resolved graph signals.',
        assumptions: ['Waiting time is not guaranteed payroll waste.', 'Attach workflow run timestamps to measure.'],
        sourceVersion: TOOL_SOURCE_VERSION,
      }),
      mode: 'estimated',
      percentiles: { p50: null, p75: null, p95: null },
    };
  }

  const install = (s.uniquePackages / 100) * ESTIMATED_INSTALL_MINUTES_PER_100_PACKAGES;
  const build =
    ESTIMATED_BUILD_BASE_MINUTES + s.duplicateGroups * ESTIMATED_BUILD_MINUTES_PER_DUPLICATE_GROUP;
  const native = s.optionalNativeHints * ESTIMATED_NATIVE_MODULE_MINUTES;
  const cacheFactor = s.ciCacheLikely ? 0.55 : 1;
  const raw = (install + build + native) * cacheFactor;
  const value = Math.min(ESTIMATED_WAIT_MAX_MINUTES, Math.max(ESTIMATED_WAIT_MIN_MINUTES, raw));

  return {
    ...EstimateSchema.parse({
      value,
      range: {
        min: ESTIMATED_WAIT_MIN_MINUTES,
        max: Math.min(ESTIMATED_WAIT_MAX_MINUTES, value * 1.8),
      },
      unit: 'minutes-hypothesis',
      confidence: 'low',
      method:
        'Bounded hypothesis from resolved package count, lockfile size, duplication, optional native hints, and cache status. Not observed latency.',
      assumptions: [
        'This is an estimated-mode hypothesis, never an observed CI duration.',
        `Clamped to ${ESTIMATED_WAIT_MIN_MINUTES}-${ESTIMATED_WAIT_MAX_MINUTES} minutes so package count cannot invent unbounded wait.`,
        'Lockfile size informs complexity only as a weak signal.',
        `Lockfile bytes supplied: ${s.lockfileBytes}.`,
      ],
      sourceVersion: TOOL_SOURCE_VERSION,
    }),
    mode: 'estimated',
    percentiles: { p50: value, p75: null, p95: null },
    queueMinutes: null,
    runnerMinutes: value,
    blockingMinutes: value,
  };
}
