import { parse as parseYaml } from 'yaml';
import { MAX_GRAPH_NODES, MAX_YAML_ALIAS_COUNT } from '../models/constants';
import { ValidationError, walkForbidProto } from '../ingestion/validate';
import type { DeclaredDependency, GraphEdge, GraphNode } from './types';

export type YarnLockParse = {
  kind: 'yarn-classic' | 'yarn-berry';
  lockfileVersion: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function classicBlocks(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n');
  return normalized.split(/\n(?=\S)/).filter((b) => b.trim() && !b.startsWith('#') && !b.startsWith('__metadata'));
}

function parseClassicLocator(header: string): { name: string } | null {
  const first = header.split(',')[0]?.replace(/^"+|"+$/g, '').trim();
  if (!first) return null;
  const at = first.lastIndexOf('@');
  if (at <= 0) return null;
  return { name: first.slice(0, at).replace(/^"+|"+$/g, '') };
}

/**
 * Detect Yarn classic (v1) vs Berry (v2+) and parse without executing package code.
 * Classic is a custom text format. Berry is YAML with __metadata.
 */
export function resolveYarnLockfile(text: string, declared: DeclaredDependency[] = []): YarnLockParse {
  const isBerry = /^__metadata:/m.test(text) || /yarn lockfile v2/i.test(text) || /\blanguageName:/m.test(text);

  if (isBerry) {
    let raw: unknown;
    try {
      raw = parseYaml(text, {
        merge: false,
        maxAliasCount: MAX_YAML_ALIAS_COUNT,
        uniqueKeys: false,
        prettyErrors: true,
      });
    } catch {
      throw new ValidationError('yarn.lock (Berry) is not valid YAML or exceeded alias/merge guards.');
    }
    walkForbidProto(raw, 'yarn.lock');
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new ValidationError('yarn.lock (Berry) root must be a mapping.');
    }
    const doc = raw as Record<string, unknown>;
    const meta = doc.__metadata && typeof doc.__metadata === 'object' ? (doc.__metadata as Record<string, unknown>) : {};
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const seen = new Set<string>();

    for (const [key, entryUnknown] of Object.entries(doc)) {
      if (key === '__metadata') continue;
      if (!entryUnknown || typeof entryUnknown !== 'object' || Array.isArray(entryUnknown)) continue;
      if (nodes.length >= MAX_GRAPH_NODES) {
        throw new ValidationError('Lockfile exceeds the graph node safety cap.');
      }
      const entry = entryUnknown as Record<string, unknown>;
      const version = typeof entry.version === 'string' ? entry.version : 'unknown';
      const locator = key.split(',')[0]?.replace(/^"+|"+$/g, '') ?? key;
      const nameMatch = locator.match(/^(@?[^@]+)@/);
      const name = nameMatch?.[1] ?? locator;
      const id = `${name}@${version}`;
      if (seen.has(id)) continue;
      seen.add(id);
      nodes.push({
        id,
        name,
        version,
        integrity: typeof entry.checksum === 'string' ? entry.checksum : null,
        dependencyType: 'prod',
        direct: declared.some((d) => d.name === name),
        parentPaths: [key],
      });
      const deps = entry.dependencies;
      if (deps && typeof deps === 'object' && !Array.isArray(deps)) {
        for (const [depName, depRange] of Object.entries(deps as Record<string, unknown>)) {
          edges.push({
            from: id,
            to: `${depName}@${typeof depRange === 'string' ? depRange : 'unknown'}`,
            kind: 'prod',
          });
        }
      }
    }
    return {
      kind: 'yarn-berry',
      lockfileVersion: meta.version != null ? String(meta.version) : 'berry',
      nodes,
      edges,
    };
  }

  if (!text.includes('yarn lockfile v1') && !/^\S.+:\n\s+version /m.test(text)) {
    throw new ValidationError('yarn.lock is neither classic nor Berry.');
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  for (const block of classicBlocks(text)) {
    if (nodes.length >= MAX_GRAPH_NODES) {
      throw new ValidationError('Lockfile exceeds the graph node safety cap.');
    }
    const lines = block.split('\n');
    const header = lines[0];
    if (!header?.includes(':')) continue;
    const loc = parseClassicLocator(header.replace(/:$/, ''));
    if (!loc) continue;
    const versionLine = lines.find((l) => /^\s+version\s+/.test(l));
    const integrityLine = lines.find((l) => /^\s+integrity\s+/.test(l));
    const version = versionLine?.replace(/^\s+version\s+"?([^"]+)"?/, '$1').trim() ?? 'unknown';
    const integrity = integrityLine?.replace(/^\s+integrity\s+/, '').trim() ?? null;
    const id = `${loc.name}@${version}`;
    if (seen.has(id)) continue;
    seen.add(id);
    nodes.push({
      id,
      name: loc.name,
      version,
      integrity,
      dependencyType: 'prod',
      direct: declared.some((d) => d.name === loc.name),
      parentPaths: [header.trim()],
    });
    let inDeps = false;
    for (const line of lines) {
      if (/^\s+dependencies:/.test(line)) {
        inDeps = true;
        continue;
      }
      if (inDeps && /^\s+\S/.test(line) && !/^\s{4,}\S/.test(line) === false) {
        const m = line.match(/^\s+"?([^"]+)"?\s+"?([^"]+)"?/);
        if (m) edges.push({ from: id, to: `${m[1]}@${m[2]}`, kind: 'prod' });
      } else if (inDeps && /^\S/.test(line)) {
        inDeps = false;
      }
    }
  }

  return { kind: 'yarn-classic', lockfileVersion: '1', nodes, edges };
}
