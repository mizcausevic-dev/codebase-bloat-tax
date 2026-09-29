import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { resolveNpmLockfile } from '../src/graph/resolveNpm';
import { resolvePnpmLockfile } from '../src/graph/resolvePnpm';
import { resolveYarnLockfile } from '../src/graph/resolveYarn';
import { declaredFromPackageJson, normalizeGraph } from '../src/graph/normalize';

const dir = dirname(fileURLToPath(import.meta.url));
const load = (name: string) => readFileSync(join(dir, 'fixtures', name), 'utf8');

describe('npm lockfile parser', () => {
  it('walks lockfileVersion 1 nested dependencies', () => {
    const parsed = resolveNpmLockfile(load('npm-v1.lock.json'));
    expect(parsed.lockfileVersion).toBe('1');
    expect(parsed.nodes.map((n) => n.name).sort()).toEqual(['once', 'wrappy']);
    expect(parsed.edges.some((e) => e.from === 'once@1.4.0' && e.to === 'wrappy@1.0.2')).toBe(true);
  });

  it('walks workspaces and duplicate versions in lockfileVersion 3', async () => {
    const parsed = resolveNpmLockfile(load('npm-workspaces.lock.json'));
    const pads = parsed.nodes.filter((n) => n.name === 'left-pad');
    expect(new Set(pads.map((p) => p.version)).size).toBe(2);
    const graph = await normalizeGraph({ npmLock: load('npm-workspaces.lock.json') });
    expect(graph.duplicateGroups.some((g) => g.name === 'left-pad')).toBe(true);
    expect(graph.installedInstances).toBeGreaterThanOrEqual(graph.uniquePackages);
  });

  it('flags optional and peer entries', () => {
    const demo = readFileSync(join(dir, '../fixtures/demo/npm-lock.demo.json'), 'utf8');
    const parsed = resolveNpmLockfile(demo);
    expect(parsed.nodes.some((n) => n.name === 'fsevents' && n.dependencyType === 'optional')).toBe(true);
    expect(parsed.nodes.some((n) => n.name === 'react-dom' && n.dependencyType === 'peer')).toBe(true);
  });

  it('rejects malformed lockfiles', () => {
    expect(() => resolveNpmLockfile('[]')).toThrow(/object/);
    expect(() => resolveNpmLockfile('{"lockfileVersion":99,"packages":{}}')).toThrow(/Unsupported/);
  });
});

describe('pnpm lockfile parser', () => {
  it('reads importers, packages, optional and peer fields', async () => {
    const parsed = await resolvePnpmLockfile(load('pnpm-lock.yaml'), [
      { name: 'zod', range: '3.23.8', dependencyType: 'prod' },
    ]);
    expect(parsed.nodes.some((n) => n.name === 'zod')).toBe(true);
    expect(parsed.nodes.some((n) => n.name === 'fsevents' && n.dependencyType === 'optional')).toBe(true);
    expect(parsed.edges.some((e) => e.kind === 'peer' || e.from.startsWith('importer:'))).toBe(true);
  });

  it('rejects YAML without packages/snapshots', async () => {
    await expect(resolvePnpmLockfile('lockfileVersion: "9.0"\nfoo: 1\n')).rejects.toThrow(/packages or snapshots/);
  });
});

describe('yarn lockfile parser', () => {
  it('parses classic v1', async () => {
    const parsed = await resolveYarnLockfile(load('yarn-classic.lock'), [
      { name: 'lodash', range: '^4.17.21', dependencyType: 'prod' },
    ]);
    expect(parsed.kind).toBe('yarn-classic');
    expect(parsed.nodes.some((n) => n.name === 'lodash' && n.version === '4.17.21')).toBe(true);
  });

  it('parses berry', async () => {
    const parsed = await resolveYarnLockfile(load('yarn-berry.lock'));
    expect(parsed.kind).toBe('yarn-berry');
    expect(parsed.nodes.some((n) => n.name === 'react')).toBe(true);
  });
});

describe('absent lockfile', () => {
  it('keeps declared directs only and marks missingLockfile', async () => {
    const pkg = { dependencies: { zod: '3.23.8' }, peerDependencies: { react: '>=18' } };
    const graph = await normalizeGraph({ packageJson: pkg });
    expect(graph.missingLockfile).toBe(true);
    expect(graph.uniquePackages).toBe(2);
    expect(graph.nodes.every((n) => n.version === 'unresolved')).toBe(true);
    expect(declaredFromPackageJson(pkg).some((d) => d.dependencyType === 'peer')).toBe(true);
  });
});
