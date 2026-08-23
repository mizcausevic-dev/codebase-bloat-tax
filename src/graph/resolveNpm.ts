import { parseJsonSafe, ValidationError } from '../ingestion/validate';
import { MAX_GRAPH_NODES } from '../models/constants';
import type { DeclaredDependency, DependencyType, GraphEdge, GraphNode } from './types';

export type NpmLockParse = {
  lockfileVersion: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
};

function nodeId(name: string, version: string): string {
  return `${name}@${version}`;
}

function typeFromPath(path: string, declared: DeclaredDependency[]): DependencyType {
  if (path.includes('node_modules/')) {
    // peer/optional flags come from the lock entry when present
  }
  const top = declared.find((d) => d.name === path.replace(/^node_modules\//, '').split('/node_modules/')[0]);
  return top?.dependencyType ?? 'prod';
}

/**
 * Arborist-compatible walk for lockfileVersion 1 (nested dependencies)
 * and 2/3 (flat packages map). Does not execute package code.
 */
export function resolveNpmLockfile(text: string, declared: DeclaredDependency[] = []): NpmLockParse {
  const raw = parseJsonSafe(text, 'package-lock.json');
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new ValidationError('package-lock.json root must be an object.');
  }
  const lock = raw as Record<string, unknown>;
  const versionNum = typeof lock.lockfileVersion === 'number' ? lock.lockfileVersion : 1;
  if (versionNum < 1 || versionNum > 3) {
    throw new ValidationError(`Unsupported npm lockfileVersion: ${String(lock.lockfileVersion)}`);
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seen = new Set<string>();

  const addNode = (node: GraphNode) => {
    if (nodes.length >= MAX_GRAPH_NODES) {
      throw new ValidationError('Lockfile exceeds the graph node safety cap.');
    }
    if (seen.has(node.id)) {
      const existing = nodes.find((n) => n.id === node.id);
      if (existing) {
        for (const p of node.parentPaths) {
          if (!existing.parentPaths.includes(p)) existing.parentPaths.push(p);
        }
        if (node.direct) existing.direct = true;
      }
      return;
    }
    seen.add(node.id);
    nodes.push(node);
  };

  if (versionNum >= 2 && lock.packages && typeof lock.packages === 'object' && !Array.isArray(lock.packages)) {
    const packages = lock.packages as Record<string, unknown>;
    const pathToId = new Map<string, string>();

    for (const [path, entryUnknown] of Object.entries(packages)) {
      if (!entryUnknown || typeof entryUnknown !== 'object' || Array.isArray(entryUnknown)) continue;
      const entry = entryUnknown as Record<string, unknown>;
      if (path === '') continue;
      const nameFromPath = path.replace(/^node_modules\//, '').split('/node_modules/').pop();
      const name = typeof entry.name === 'string' ? entry.name : nameFromPath;
      const version = typeof entry.version === 'string' ? entry.version : 'unknown';
      if (!name) continue;
      const id = nodeId(name, version);
      pathToId.set(path, id);
      let dependencyType: DependencyType = 'prod';
      if (entry.dev === true) dependencyType = 'dev';
      if (entry.optional === true) dependencyType = 'optional';
      if (entry.peer === true) dependencyType = entry.optional === true ? 'peerOptional' : 'peer';
      const topLevel = /^node_modules\/[^/]+$/.test(path) || /^node_modules\/@[^/]+\/[^/]+$/.test(path);
      addNode({
        id,
        name,
        version,
        integrity: typeof entry.integrity === 'string' ? entry.integrity : null,
        dependencyType,
        direct: topLevel || declared.some((d) => d.name === name),
        parentPaths: [path],
      });
    }

    for (const [path, entryUnknown] of Object.entries(packages)) {
      if (!entryUnknown || typeof entryUnknown !== 'object' || Array.isArray(entryUnknown)) continue;
      const entry = entryUnknown as Record<string, unknown>;
      const fromId = path === '' ? 'root' : pathToId.get(path);
      if (!fromId) continue;
      const depGroups: Array<[string, DependencyType]> = [
        ['dependencies', 'prod'],
        ['devDependencies', 'dev'],
        ['optionalDependencies', 'optional'],
        ['peerDependencies', 'peer'],
      ];
      for (const [field, kind] of depGroups) {
        const deps = entry[field];
        if (!deps || typeof deps !== 'object' || Array.isArray(deps)) continue;
        for (const depName of Object.keys(deps as Record<string, unknown>)) {
          const childPath = path === '' ? `node_modules/${depName}` : `${path}/node_modules/${depName}`;
          const resolvedPath = pathToId.has(childPath)
            ? childPath
            : pathToId.has(`node_modules/${depName}`)
              ? `node_modules/${depName}`
              : undefined;
          const toId = resolvedPath ? pathToId.get(resolvedPath) : undefined;
          if (toId) edges.push({ from: fromId, to: toId, kind });
        }
      }
    }

    return { lockfileVersion: String(versionNum), nodes, edges };
  }

  // lockfileVersion 1: nested dependencies
  const walk = (depsUnknown: unknown, parentId: string, parentPath: string) => {
    if (!depsUnknown || typeof depsUnknown !== 'object' || Array.isArray(depsUnknown)) return;
    for (const [name, entryUnknown] of Object.entries(depsUnknown as Record<string, unknown>)) {
      if (!entryUnknown || typeof entryUnknown !== 'object' || Array.isArray(entryUnknown)) continue;
      const entry = entryUnknown as Record<string, unknown>;
      const version = typeof entry.version === 'string' ? entry.version : 'unknown';
      const id = nodeId(name, version);
      const path = parentPath ? `${parentPath}/node_modules/${name}` : `node_modules/${name}`;
      addNode({
        id,
        name,
        version,
        integrity: typeof entry.integrity === 'string' ? entry.integrity : null,
        dependencyType: entry.dev === true ? 'dev' : entry.optional === true ? 'optional' : typeFromPath(path, declared),
        direct: parentId === 'root',
        parentPaths: [path],
      });
      edges.push({
        from: parentId,
        to: id,
        kind: entry.dev === true ? 'dev' : entry.optional === true ? 'optional' : 'prod',
      });
      walk(entry.dependencies, id, path);
    }
  };
  walk(lock.dependencies, 'root', '');
  return { lockfileVersion: String(versionNum), nodes, edges };
}
