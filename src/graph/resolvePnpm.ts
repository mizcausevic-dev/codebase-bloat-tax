import { MAX_GRAPH_NODES } from '../models/constants';
import { ValidationError } from '../ingestion/validate';
import { parseYamlSafe } from './parseYamlSafe';
import type { DeclaredDependency, GraphEdge, GraphNode } from './types';

export type PnpmLockParse = {
  lockfileVersion: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function parseSnapshotKey(key: string): { name: string; version: string } | null {
  // pnpm v9: /name@version or /@scope/name@version
  // pnpm v6: /name/version or /@scope/name/version
  if (key.startsWith('/')) {
    const body = key.slice(1);
    const at = body.lastIndexOf('@');
    if (at > 0) {
      return { name: body.slice(0, at), version: body.slice(at + 1).split('(')[0] };
    }
    const parts = body.split('/');
    if (body.startsWith('@') && parts.length >= 3) {
      return { name: `${parts[0]}/${parts[1]}`, version: parts[2].split('(')[0] };
    }
    if (parts.length >= 2) {
      return { name: parts[0], version: parts[1].split('(')[0] };
    }
  }
  const at = key.lastIndexOf('@');
  if (at > 0) return { name: key.slice(0, at), version: key.slice(at + 1).split('(')[0] };
  return null;
}

/**
 * Official-format pnpm lock parser (importers, packages, snapshots).
 * yaml merge keys disabled; alias cap set. Does not execute package code.
 */
export async function resolvePnpmLockfile(text: string, declared: DeclaredDependency[] = []): Promise<PnpmLockParse> {
  const raw = await parseYamlSafe(text, 'pnpm-lock.yaml', true);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('pnpm-lock.yaml root must be a mapping.');
  }
  const lock = raw as Record<string, unknown>;
  const lockfileVersion = lock.lockfileVersion != null ? String(lock.lockfileVersion) : 'unknown';

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const packages = (lock.packages ?? lock.snapshots) as Record<string, unknown> | undefined;
  if (!packages || typeof packages !== 'object' || Array.isArray(packages)) {
    throw new ValidationError('pnpm-lock.yaml is missing a packages or snapshots map.');
  }

  for (const [key, entryUnknown] of Object.entries(packages)) {
    if (nodes.length >= MAX_GRAPH_NODES) {
      throw new ValidationError('Lockfile exceeds the graph node safety cap.');
    }
    const parsed = parseSnapshotKey(key);
    if (!parsed) continue;
    const id = `${parsed.name}@${parsed.version}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = entryUnknown && typeof entryUnknown === 'object' && !Array.isArray(entryUnknown)
      ? (entryUnknown as Record<string, unknown>)
      : {};
    const resolution = entry.resolution && typeof entry.resolution === 'object'
      ? (entry.resolution as Record<string, unknown>)
      : {};
    nodes.push({
      id,
      name: parsed.name,
      version: parsed.version,
      integrity: typeof resolution.integrity === 'string' ? resolution.integrity : null,
      dependencyType: entry.dev === true ? 'dev' : entry.optional === true ? 'optional' : 'prod',
      direct: declared.some((d) => d.name === parsed.name),
      parentPaths: [key],
    });

    const depFields: Array<['dependencies' | 'optionalDependencies' | 'peerDependencies', GraphEdge['kind']]> = [
      ['dependencies', 'prod'],
      ['optionalDependencies', 'optional'],
      ['peerDependencies', 'peer'],
    ];
    for (const [field, kind] of depFields) {
      const deps = entry[field];
      if (!deps || typeof deps !== 'object' || Array.isArray(deps)) continue;
      for (const [depName, depVer] of Object.entries(deps as Record<string, unknown>)) {
        const version = typeof depVer === 'string' ? depVer.split('(')[0] : 'unknown';
        edges.push({ from: id, to: `${depName}@${version}`, kind });
      }
    }
  }

  const importers = lock.importers;
  if (importers && typeof importers === 'object' && !Array.isArray(importers)) {
    for (const [importerPath, importerUnknown] of Object.entries(importers as Record<string, unknown>)) {
      if (!importerUnknown || typeof importerUnknown !== 'object' || Array.isArray(importerUnknown)) continue;
      const importer = importerUnknown as Record<string, unknown>;
      for (const field of ['dependencies', 'devDependencies', 'optionalDependencies'] as const) {
        const deps = importer[field];
        if (!deps || typeof deps !== 'object' || Array.isArray(deps)) continue;
        for (const [name, specUnknown] of Object.entries(deps as Record<string, unknown>)) {
          const spec = specUnknown && typeof specUnknown === 'object' ? (specUnknown as Record<string, unknown>) : {};
          const version = typeof spec.version === 'string' ? spec.version.split('(')[0] : 'unknown';
          const id = `${name}@${version}`;
          const existing = nodes.find((n) => n.name === name);
          if (existing) existing.direct = true;
          edges.push({
            from: `importer:${importerPath}`,
            to: existing?.id ?? id,
            kind: field === 'devDependencies' ? 'dev' : field === 'optionalDependencies' ? 'optional' : 'prod',
          });
        }
      }
    }
  }

  return { lockfileVersion, nodes, edges };
}
