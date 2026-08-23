import { z } from 'zod';
import { FETCH_TIMEOUT_MS, LOOKUP_MAX_PACKAGES } from '../models/constants';
import { cacheGet, cacheSet } from './cache';

const NpmPackumentSchema = z.object({
  name: z.string().min(1),
  'dist-tags': z.object({ latest: z.string().min(1) }).passthrough(),
  time: z.record(z.string()).optional(),
  versions: z.record(
    z.object({
      version: z.string().min(1),
      license: z.union([z.string(), z.object({ type: z.string() })]).optional(),
      repository: z
        .union([z.string(), z.object({ url: z.string().optional() })])
        .optional(),
      dependencies: z.record(z.string()).optional(),
    }).passthrough(),
  ),
});

export type NpmPackageMeta = {
  name: string;
  latest: string;
  license: string | null;
  repository: string | null;
  publishedAt: string | null;
};

export type NpmLookup = {
  packages: NpmPackageMeta[];
  attempted: boolean;
  ok: boolean;
  error?: string;
  cached?: boolean;
};

async function fetchPackument(name: string): Promise<NpmPackageMeta> {
  const cached = cacheGet<NpmPackageMeta>(`npm:${name}`);
  if (cached) return cached;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (res.status === 429) throw new Error('npm registry rate-limited this request.');
    if (!res.ok) throw new Error(`npm registry returned HTTP ${res.status}.`);
    const json: unknown = await res.json();
    const parsed = NpmPackumentSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error('npm registry payload failed schema validation and was discarded.');
    }
    const latest = parsed.data['dist-tags'].latest;
    const ver = parsed.data.versions[latest];
    const license =
      typeof ver?.license === 'string'
        ? ver.license
        : ver?.license && typeof ver.license === 'object'
          ? ver.license.type
          : null;
    const repository =
      typeof ver?.repository === 'string'
        ? ver.repository
        : ver?.repository && typeof ver.repository === 'object'
          ? ver.repository.url ?? null
          : null;
    const meta: NpmPackageMeta = {
      name: parsed.data.name,
      latest,
      license,
      repository,
      publishedAt: parsed.data.time?.[latest] ?? null,
    };
    cacheSet(`npm:${name}`, meta);
    return meta;
  } finally {
    clearTimeout(t);
  }
}

export async function lookupNpmRegistry(names: string[]): Promise<NpmLookup> {
  const slice = [...new Set(names)].slice(0, LOOKUP_MAX_PACKAGES);
  if (slice.length === 0) return { packages: [], attempted: false, ok: true };
  const packages: NpmPackageMeta[] = [];
  const errors: string[] = [];
  let cached = false;
  for (const name of slice) {
    if (cacheGet(`npm:${name}`)) cached = true;
    try {
      packages.push(await fetchPackument(name));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'npm lookup failed.');
    }
  }
  return {
    packages,
    attempted: true,
    ok: errors.length === 0,
    error: errors[0],
    cached,
  };
}
