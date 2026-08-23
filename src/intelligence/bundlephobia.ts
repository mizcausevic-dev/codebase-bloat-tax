import { z } from 'zod';
import { FETCH_TIMEOUT_MS, LOOKUP_MAX_PACKAGES } from '../models/constants';
import { cacheGet, cacheSet } from './cache';
import type { BundlephobiaAdvisory } from '../models/bundleImpact';

const BundlephobiaResponseSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  gzip: z.number().finite().nonnegative(),
  size: z.number().finite().nonnegative(),
});

export type BundlephobiaLookup = {
  advisories: BundlephobiaAdvisory[];
  attempted: boolean;
  ok: boolean;
  error?: string;
  cached?: boolean;
};

async function fetchOne(name: string, version?: string): Promise<BundlephobiaAdvisory> {
  const spec = version ? `${name}@${version}` : name;
  const cached = cacheGet<BundlephobiaAdvisory>(`bp:${spec}`);
  if (cached) return cached;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const url = `https://bundlephobia.com/api/size?package=${encodeURIComponent(spec)}`;
    const res = await fetch(url, { signal: ctrl.signal });
    if (res.status === 429) throw new Error('Bundlephobia rate-limited this request.');
    if (!res.ok) throw new Error(`Bundlephobia returned HTTP ${res.status}.`);
    const json: unknown = await res.json();
    const parsed = BundlephobiaResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new Error('Bundlephobia payload failed schema validation and was discarded.');
    }
    const advisory = {
      name: parsed.data.name,
      version: parsed.data.version,
      gzip: parsed.data.gzip,
      size: parsed.data.size,
    };
    cacheSet(`bp:${spec}`, advisory);
    return advisory;
  } finally {
    clearTimeout(t);
  }
}

/**
 * Advisory-only package min+gzip. Callers must not sum gzip across packages
 * into an application bundle total. See assessBundleImpact.
 */
export async function lookupBundlephobia(
  packages: Array<{ name: string; version?: string }>,
): Promise<BundlephobiaLookup> {
  const slice = packages.slice(0, LOOKUP_MAX_PACKAGES);
  if (slice.length === 0) {
    return { advisories: [], attempted: false, ok: true };
  }
  const advisories: BundlephobiaAdvisory[] = [];
  const errors: string[] = [];
  let cached = false;
  for (const pkg of slice) {
    const spec = pkg.version ? `${pkg.name}@${pkg.version}` : pkg.name;
    if (cacheGet(`bp:${spec}`)) cached = true;
    try {
      advisories.push(await fetchOne(pkg.name, pkg.version));
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Bundlephobia lookup failed.');
    }
  }
  return {
    advisories,
    attempted: true,
    ok: errors.length === 0,
    error: errors[0],
    cached,
  };
}
