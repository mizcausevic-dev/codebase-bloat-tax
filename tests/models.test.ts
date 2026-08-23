import { describe, expect, it } from 'vitest';
import { assessBundleImpact, assertDoNotSumGzip } from '../src/models/bundleImpact';
import { assessMobileCost } from '../src/models/mobileCost';
import { assessBuildWait } from '../src/models/buildWait';
import { assessOpportunityCost } from '../src/models/opportunityCost';
import { proposeAlternatives } from '../src/models/alternatives';
import { DEFAULT_HOURLY_COST_USD, WEEKS_PER_YEAR } from '../src/models/constants';

describe('bundleImpact', () => {
  it('attributes measured artifacts by kind', () => {
    const result = assessBundleImpact({
      artifact: {
        modules: [
          { id: 'main', bytes: 1000, gzipBytes: 400, kind: 'initial', entry: 'app' },
          { id: 'lazy', bytes: 800, kind: 'lazy', entry: 'app' },
          { id: 'ssr', bytes: 2000, kind: 'server-only', entry: 'server' },
        ],
      },
    });
    expect(result.kind).toBe('measured-artifact');
    expect(result.value).toBe(1000);
    expect(result.confidence).toBe('measured');
    expect(result.transfer.gzipMs.value).toBeGreaterThan(0);
    expect(result.doNotSumGzipInvariant).toBe(true);
  });

  it('does not sum Bundlephobia gzip into a bundle total', () => {
    const advisories = [
      { name: 'a', version: '1.0.0', gzip: 10_000, size: 40_000 },
      { name: 'b', version: '1.0.0', gzip: 20_000, size: 80_000 },
    ];
    const result = assessBundleImpact({ advisories });
    expect(result.kind).toBe('potential-package-footprint');
    expect(result.value).toBe(20_000);
    expect(result.value).not.toBe(30_000);
    expect(assertDoNotSumGzip(advisories)).toBe(20_000);
  });
});

describe('mobileCost', () => {
  it('does not infer parse time from bytes and labels modeled slowdown', () => {
    const result = assessMobileCost({ desktopParseEvalMs: 100, slowdown: 4 });
    expect(result.value).toBe(400);
    expect(result.modeled).toBe(true);
    expect(result.confidence).toBe('low');
    expect(result.limitation).toMatch(/does not fully simulate mobile disk/);
  });

  it('stays unmeasured without an observed parse/eval duration', () => {
    const result = assessMobileCost({});
    expect(result.value).toBeNull();
    expect(result.confidence).toBe('unmeasured');
  });
});

describe('buildWait', () => {
  it('computes measured percentiles from CI samples', () => {
    const result = assessBuildWait({
      samples: [
        { totalMinutes: 4, queueMinutes: 1, runnerMinutes: 3 },
        { totalMinutes: 6, queueMinutes: 1, runnerMinutes: 5 },
        { totalMinutes: 10, queueMinutes: 2, runnerMinutes: 8 },
      ],
    });
    expect(result.mode).toBe('measured');
    expect(result.percentiles?.p50).toBeTypeOf('number');
    expect(result.confidence).toBe('medium');
  });

  it('clamps estimated mode and never calls it observed', () => {
    const result = assessBuildWait({
      signals: {
        uniquePackages: 800,
        lockfileBytes: 120_000,
        duplicateGroups: 12,
        optionalNativeHints: 3,
        ciCacheLikely: false,
      },
    });
    expect(result.mode).toBe('estimated');
    expect(result.method).toMatch(/Not observed/);
    expect(result.value).toBeLessThanOrEqual(45);
  });
});

describe('opportunityCost', () => {
  it('uses the published formula', () => {
    const result = assessOpportunityCost({
      teamSize: 4,
      runsPerWeek: 10,
      weeksPerYear: WEEKS_PER_YEAR,
      blockingMinutesPerRun: 6,
      affectedDevelopers: 2,
      hourlyCost: 100,
    });
    expect(result.annualBlockingHours.value).toBe((10 * 52 * 6 * 2) / 60);
    expect(result.value).toBe(((10 * 52 * 6 * 2) / 60) * 100);
    expect(result.inputsUsed.defaultsWereUsed).toBe(false);
    expect(result.assumptions.join(' ')).toMatch(/never guaranteed salary burn/i);
  });

  it('labels defaults when operator inputs are missing', () => {
    const result = assessOpportunityCost({});
    expect(result.inputsUsed.hourlyCost).toBe(DEFAULT_HOURLY_COST_USD);
    expect(result.inputsUsed.defaultsWereUsed).toBe(true);
    expect(result.confidence).toBe('low');
  });
});

describe('alternatives', () => {
  it('defaults to measure-first without artifacts and avoids silent security swaps', () => {
    const recs = proposeAlternatives({
      hasBundleArtifact: false,
      hasLockfile: true,
      signals: [
        {
          name: 'jsonwebtoken',
          reasons: ['known-smaller-modular-alt'],
          evidence: ['smaller alt exists on paper'],
          suggestedAlt: 'jose',
          securitySensitive: true,
        },
      ],
    });
    expect(recs.some((r) => r.id === 'measure-first-default')).toBe(true);
    const jwt = recs.find((r) => r.packageName === 'jsonwebtoken');
    expect(jwt?.category).toBe('measure-first');
    expect(jwt?.migrationRisk).toBe('high');
  });
});
