import type { BundleArtifact, BundleModule } from '../models/bundleImpact';
import type { CiJobSample } from '../models/buildWait';
import type { MobileArtifact } from '../models/mobileCost';

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** Prefer project stats/metafiles. Never invent sizes from package count. */
export function parseBundleArtifact(stats: unknown, metafile: unknown): BundleArtifact | undefined {
  const modules: BundleModule[] = [];

  if (isRecord(metafile) && isRecord(metafile.outputs)) {
    for (const [name, outUnknown] of Object.entries(metafile.outputs)) {
      if (!isRecord(outUnknown)) continue;
      const bytes = typeof outUnknown.bytes === 'number' ? outUnknown.bytes : 0;
      const inputs = isRecord(outUnknown.inputs) ? Object.keys(outUnknown.inputs) : [];
      const serverOnly = name.includes('server') || name.endsWith('.ssr.js');
      const lazy = name.includes('chunk') || name.includes('async');
      modules.push({
        id: name,
        bytes,
        kind: serverOnly ? 'server-only' : lazy ? 'lazy' : 'initial',
        entry: inputs[0] ?? name,
      });
    }
  }

  if (isRecord(stats) && Array.isArray(stats.assets)) {
    for (const asset of stats.assets) {
      if (!isRecord(asset)) continue;
      const name = typeof asset.name === 'string' ? asset.name : 'asset';
      const bytes = typeof asset.size === 'number' ? asset.size : 0;
      const lazy = asset.chunks && Array.isArray(asset.chunks) && asset.chunks.length > 1;
      modules.push({
        id: name,
        bytes,
        kind: name.includes('server') ? 'server-only' : lazy ? 'lazy' : 'initial',
        entry: name,
      });
    }
  }

  if (isRecord(stats) && Array.isArray(stats.chunks)) {
    for (const chunk of stats.chunks) {
      if (!isRecord(chunk)) continue;
      const name = typeof chunk.names === 'object' && Array.isArray(chunk.names) ? String(chunk.names[0]) : 'chunk';
      const bytes = typeof chunk.size === 'number' ? chunk.size : 0;
      const initial = chunk.initial === true;
      modules.push({
        id: typeof chunk.id === 'string' || typeof chunk.id === 'number' ? String(chunk.id) : name,
        bytes,
        kind: initial ? 'initial' : 'lazy',
        entry: name,
      });
    }
  }

  return modules.length > 0 ? { modules } : undefined;
}

export function parseLighthouse(raw: unknown): MobileArtifact | undefined {
  if (!isRecord(raw)) return undefined;
  const audits = isRecord(raw.audits) ? raw.audits : undefined;
  const bootup = audits && isRecord(audits['bootup-time']) ? audits['bootup-time'] : undefined;
  const numeric = bootup && typeof bootup.numericValue === 'number' ? bootup.numericValue : undefined;
  if (numeric === undefined) return undefined;
  const config = isRecord(raw.configSettings) ? raw.configSettings : {};
  const form = typeof config.formFactor === 'string' ? config.formFactor : undefined;
  return {
    kind: 'lighthouse',
    parseEvalMs: numeric,
    device: form === 'mobile' ? 'mobile' : 'desktop',
  };
}

export function parseCiTimestamps(raw: unknown): CiJobSample[] | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.samples)) return undefined;
  const samples: CiJobSample[] = [];
  for (const item of raw.samples) {
    if (!isRecord(item) || typeof item.totalMinutes !== 'number') continue;
    samples.push({
      installMinutes: typeof item.installMinutes === 'number' ? item.installMinutes : undefined,
      buildMinutes: typeof item.buildMinutes === 'number' ? item.buildMinutes : undefined,
      testMinutes: typeof item.testMinutes === 'number' ? item.testMinutes : undefined,
      queueMinutes: typeof item.queueMinutes === 'number' ? item.queueMinutes : undefined,
      runnerMinutes: typeof item.runnerMinutes === 'number' ? item.runnerMinutes : undefined,
      totalMinutes: item.totalMinutes,
    });
  }
  return samples.length > 0 ? samples : undefined;
}
