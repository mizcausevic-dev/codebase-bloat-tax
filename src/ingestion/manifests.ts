import { parseJsonSafe, assertAllowedFilename, assertSize, ValidationError } from './validate';
import type { FileRole } from '../schemas/report';
import { MAX_UPLOAD_BYTES } from '../models/constants';

export type { FileRole };

export type IngestedFile = {
  name: string;
  role: FileRole;
  bytes: number;
  text?: string;
};

export function classifyFilename(name: string): FileRole {
  const base = name.replace(/\\/g, '/').split('/').pop()?.toLowerCase() ?? '';
  if (base === 'package.json') return 'package-json';
  if (base === 'package-lock.json' || base === 'npm-shrinkwrap.json') return 'npm-lock';
  if (base === 'pnpm-lock.yaml') return 'pnpm-lock';
  if (base === 'yarn.lock') return 'yarn-lock';
  if (base === 'stats.json' || base.endsWith('.stats.json')) return 'bundler-stats';
  if (base.includes('visualizer') || base === 'stats.html') return 'vite-visualizer';
  if (base.includes('metafile') || base === 'meta.json' || base === 'metafile.json') return 'esbuild-metafile';
  if (base.endsWith('.map') || base.includes('sourcemap')) return 'source-map';
  if (base.includes('lighthouse')) return 'lighthouse';
  if (base.includes('trace')) return 'chrome-trace';
  if (base.includes('ci-timestamps') || base.includes('workflow-runs')) return 'ci-timestamps';
  return 'unknown';
}

export function ingestTextFile(name: string, text: string): IngestedFile {
  assertAllowedFilename(name);
  const bytes = new TextEncoder().encode(text).length;
  assertSize(bytes, MAX_UPLOAD_BYTES, name);
  return { name, role: classifyFilename(name), bytes, text };
}

export function collectManifests(files: IngestedFile[]): {
  packageJson?: unknown;
  npmLock?: string;
  pnpmLock?: string;
  yarnLock?: string;
  bundlerStats?: unknown;
  metafile?: unknown;
  lighthouse?: unknown;
  ciTimestamps?: unknown;
} {
  const out: ReturnType<typeof collectManifests> = {};
  for (const file of files) {
    if (!file.text) continue;
    if (file.role === 'package-json') out.packageJson = parseJsonSafe(file.text, file.name);
    if (file.role === 'npm-lock') out.npmLock = file.text;
    if (file.role === 'pnpm-lock') out.pnpmLock = file.text;
    if (file.role === 'yarn-lock') out.yarnLock = file.text;
    if (file.role === 'bundler-stats' || file.role === 'source-map') {
      out.bundlerStats = parseJsonSafe(file.text, file.name);
    }
    if (file.role === 'esbuild-metafile') out.metafile = parseJsonSafe(file.text, file.name);
    if (file.role === 'lighthouse') out.lighthouse = parseJsonSafe(file.text, file.name);
    if (file.role === 'ci-timestamps') out.ciTimestamps = parseJsonSafe(file.text, file.name);
  }
  if (!out.packageJson && !out.npmLock && !out.pnpmLock && !out.yarnLock) {
    // Allowed: snippet-only analyses have no manifests. Caller decides.
  }
  return out;
}

export function parseImportSnippet(text: string): string[] {
  const names = new Set<string>();
  const re =
    /(?:import\s+(?:[\s\S]*?\s+from\s+)?|export\s+[\s\S]*?\s+from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const spec = m[1];
    if (!spec || spec.startsWith('.') || spec.startsWith('/')) continue;
    const pkg = spec.startsWith('@')
      ? spec.split('/').slice(0, 2).join('/')
      : spec.split('/')[0];
    if (pkg) names.add(pkg);
  }
  if (names.size === 0) {
    throw new ValidationError('No package import specifiers were found in the snippet.');
  }
  return [...names];
}
