import { describe, expect, it } from 'vitest';
import { CodebaseBloatReportSchema, EstimateSchema } from '../src/schemas/report';
import { exportMarkdown, redactSecrets } from '../src/export/markdown';
import {
  assertAllowedFilename,
  parseGithubRepoUrl,
  parseJsonSafe,
  ValidationError,
} from '../src/ingestion/validate';
import { DISCLAIMER, TOOL_SOURCE_VERSION } from '../src/models/constants';

const estimate = {
  value: 1,
  unit: 'bytes',
  confidence: 'low' as const,
  method: 'test',
  assumptions: ['labeled'],
  sourceVersion: TOOL_SOURCE_VERSION,
};

describe('Zod contracts reject malformed data', () => {
  it('rejects estimates missing method/assumptions/sourceVersion', () => {
    expect(EstimateSchema.safeParse({ value: 1, unit: 'x', confidence: 'high' }).success).toBe(false);
    expect(EstimateSchema.safeParse({ ...estimate, confidence: 'optimistic' }).success).toBe(false);
    expect(EstimateSchema.safeParse({ ...estimate, range: { min: 9, max: 1 } }).success).toBe(false);
  });

  it('rejects a partial report that omitted disclaimer or graph', () => {
    const parsed = CodebaseBloatReportSchema.safeParse({ generatedAt: 'nope' });
    expect(parsed.success).toBe(false);
  });
});

describe('markdown redaction', () => {
  it('strips tokens, emails, and absolute paths', () => {
    const dirty = 'token ghp_notarealtokenexample000 email a@b.com path C:\\Users\\someone\\secret\\lock.json';
    const clean = redactSecrets(dirty);
    expect(clean).not.toMatch(/ghp_/);
    expect(clean).not.toMatch(/a@b.com/);
    expect(clean).not.toMatch(/C:\\Users/);
    expect(clean).toMatch(/\[redacted-secret\]/);
  });

  it('keeps top 3 findings and the disclaimer', () => {
    const report = CodebaseBloatReportSchema.parse({
      generatedAt: new Date().toISOString(),
      sourceVersion: TOOL_SOURCE_VERSION,
      disclaimer: DISCLAIMER,
      inputs: {
        sourceKind: 'upload',
        files: [{ name: 'package.json', role: 'package-json', bytes: 12 }],
        hasLockfile: false,
        hasBundleArtifact: false,
        hasCiTimestamps: false,
        hasMobileArtifact: false,
      },
      evidenceQuality: { strongestTier: 5, notes: ['snippet only'] },
      graph: {
        uniquePackages: 0,
        installedInstances: 0,
        directCount: 0,
        transitiveCount: 0,
        duplicateGroups: [],
        missingLockfile: true,
        nodes: [],
        edges: [],
        manager: 'unknown',
        lockfileVersion: null,
      },
      bundle: {
        ...estimate,
        kind: 'unmeasured',
        entries: [],
        transfer: {
          gzipMs: estimate,
          brotliMs: estimate,
          profileId: 'fast-4g',
        },
        doNotSumGzipInvariant: true,
      },
      mobile: {
        ...estimate,
        modeled: false,
        limitation:
          'Chrome DevTools CPU throttling does not fully simulate mobile disk, memory bandwidth, thermal, GPU, device variance, or field network.',
      },
      buildWait: { ...estimate, mode: 'estimated' },
      opportunityCost: {
        ...estimate,
        annualBlockingHours: estimate,
        inputsUsed: {
          teamSize: 1,
          runsPerWeek: 1,
          weeksPerYear: 52,
          blockingMinutesPerRun: 1,
          affectedDevelopers: 1,
          hourlyCost: 1,
          defaultsWereUsed: true,
        },
      },
      alternatives: [
        {
          id: '1',
          title: 'one',
          category: 'measure-first',
          confidence: 'low',
          migrationRisk: 'low',
          evidence: ['e1'],
          action: 'measure',
        },
        {
          id: '2',
          title: 'two',
          category: 'defer',
          confidence: 'low',
          migrationRisk: 'low',
          evidence: ['e2'],
          action: 'wait',
        },
        {
          id: '3',
          title: 'three',
          category: 'remove',
          confidence: 'low',
          migrationRisk: 'low',
          evidence: ['e3'],
          action: 'drop',
        },
        {
          id: '4',
          title: 'four should not appear',
          category: 'replace',
          confidence: 'low',
          migrationRisk: 'low',
          evidence: ['e4'],
          action: 'swap',
        },
      ],
      security: {
        findings: [],
        peerDepsUncovered: true,
        distinctFromPerformance: true,
        note: 'distinct',
      },
      lookups: {
        bundlephobia: { attempted: false, ok: true },
        npmRegistry: { attempted: false, ok: true },
        vulnerabilities: { attempted: false, ok: true },
      },
    });
    const md = exportMarkdown(report);
    expect(md).toContain(DISCLAIMER);
    expect(md).toContain('### 3.');
    expect(md).not.toContain('four should not appear');
    expect(md).toMatch(/Measured vs heuristic/);
  });
});

describe('URL and file validation', () => {
  it('accepts github.com and rejects SSRF-ish hosts', () => {
    expect(parseGithubRepoUrl('https://github.com/acme/widgets').repo).toBe('widgets');
    expect(() => parseGithubRepoUrl('https://evil.com/acme/widgets')).toThrow(ValidationError);
    expect(() => parseGithubRepoUrl('https://127.0.0.1/acme/widgets')).toThrow(ValidationError);
    expect(() => parseGithubRepoUrl('file:///etc/passwd')).toThrow(ValidationError);
    expect(() => parseGithubRepoUrl('https://user:pass@github.com/acme/widgets')).toThrow(ValidationError);
    expect(() => parseGithubRepoUrl('https://github.com.evil.example/acme/widgets')).toThrow(ValidationError);
  });

  it('rejects disallowed types, traversal, and prototype pollution keys', () => {
    expect(() => assertAllowedFilename('../../etc/passwd')).toThrow(ValidationError);
    expect(() => assertAllowedFilename('malware.exe')).toThrow(ValidationError);
    expect(() => parseJsonSafe('{"__proto__":{"admin":true}}')).toThrow(/forbidden key/);
  });
});
