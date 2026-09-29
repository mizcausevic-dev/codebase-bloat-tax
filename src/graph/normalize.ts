import type { CodebaseBloatReport } from '../schemas/report';
import type { DeclaredDependency, GraphEdge, GraphNode, NormalizedGraph, PackageManager } from './types';
import { resolveNpmLockfile } from './resolveNpm';
import { resolvePnpmLockfile } from './resolvePnpm';
import { resolveYarnLockfile } from './resolveYarn';

export type LockfileKind = 'npm' | 'pnpm' | 'yarn';

export function declaredFromPackageJson(pkg: unknown): DeclaredDependency[] {
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) return [];
  const rec = pkg as Record<string, unknown>;
  const out: DeclaredDependency[] = [];
  const groups: Array<[string, DeclaredDependency['dependencyType']]> = [
    ['dependencies', 'prod'],
    ['devDependencies', 'dev'],
    ['optionalDependencies', 'optional'],
    ['peerDependencies', 'peer'],
  ];
  for (const [field, kind] of groups) {
    const deps = rec[field];
    if (!deps || typeof deps !== 'object' || Array.isArray(deps)) continue;
    for (const [name, range] of Object.entries(deps as Record<string, unknown>)) {
      out.push({ name, range: typeof range === 'string' ? range : '*', dependencyType: kind });
    }
  }
  return out;
}

export async function normalizeGraph(input: {
  packageJson?: unknown;
  npmLock?: string;
  pnpmLock?: string;
  yarnLock?: string;
}): Promise<NormalizedGraph> {
  const declared = declaredFromPackageJson(input.packageJson);

  if (input.npmLock) {
    const parsed = resolveNpmLockfile(input.npmLock, declared);
    return finish('npm', parsed.lockfileVersion, parsed.nodes, parsed.edges, declared, false);
  }
  if (input.pnpmLock) {
    const parsed = await resolvePnpmLockfile(input.pnpmLock, declared);
    return finish('pnpm', parsed.lockfileVersion, parsed.nodes, parsed.edges, declared, false);
  }
  if (input.yarnLock) {
    const parsed = await resolveYarnLockfile(input.yarnLock, declared);
    return finish(parsed.kind, parsed.lockfileVersion, parsed.nodes, parsed.edges, declared, false);
  }

  const nodes: GraphNode[] = declared.map((d) => ({
    id: `${d.name}@declared`,
    name: d.name,
    version: 'unresolved',
    integrity: null,
    dependencyType: d.dependencyType,
    direct: true,
    parentPaths: ['package.json'],
  }));
  return finish('unknown', null, nodes, [], declared, true);
}

function finish(
  manager: PackageManager,
  lockfileVersion: string | null,
  nodes: GraphNode[],
  edges: GraphEdge[],
  declared: DeclaredDependency[],
  missingLockfile: boolean,
): NormalizedGraph {
  const declaredNames = new Set(declared.map((d) => d.name));
  for (const n of nodes) {
    if (declaredNames.has(n.name)) n.direct = true;
  }
  const uniqueNames = new Set(nodes.map((n) => n.name));
  const byName = new Map<string, Set<string>>();
  for (const n of nodes) {
    const set = byName.get(n.name) ?? new Set<string>();
    set.add(n.version);
    byName.set(n.name, set);
  }
  const duplicateGroups = [...byName.entries()]
    .filter(([, versions]) => versions.size > 1)
    .map(([name, versions]) => ({
      name,
      versions: [...versions],
      instanceCount: nodes.filter((n) => n.name === name).length,
    }));

  return {
    manager,
    lockfileVersion,
    nodes,
    edges,
    uniquePackages: uniqueNames.size,
    installedInstances: nodes.length,
    directCount: nodes.filter((n) => n.direct).length,
    transitiveCount: nodes.filter((n) => !n.direct).length,
    duplicateGroups,
    missingLockfile,
  };
}

export function graphToReportShape(graph: NormalizedGraph): CodebaseBloatReport['graph'] {
  return {
    uniquePackages: graph.uniquePackages,
    installedInstances: graph.installedInstances,
    directCount: graph.directCount,
    transitiveCount: graph.transitiveCount,
    duplicateGroups: graph.duplicateGroups,
    missingLockfile: graph.missingLockfile,
    nodes: graph.nodes,
    edges: graph.edges,
    manager: graph.manager,
    lockfileVersion: graph.lockfileVersion,
  };
}
