export type DependencyType = 'prod' | 'dev' | 'optional' | 'peer' | 'peerOptional' | 'unknown';

export type PackageManager = 'npm' | 'pnpm' | 'yarn-classic' | 'yarn-berry' | 'unknown';

export type GraphNode = {
  id: string;
  name: string;
  version: string;
  integrity: string | null;
  dependencyType: DependencyType;
  direct: boolean;
  parentPaths: string[];
};

export type GraphEdge = {
  from: string;
  to: string;
  kind: DependencyType;
};

export type NormalizedGraph = {
  manager: PackageManager;
  lockfileVersion: string | null;
  nodes: GraphNode[];
  edges: GraphEdge[];
  uniquePackages: number;
  installedInstances: number;
  directCount: number;
  transitiveCount: number;
  duplicateGroups: Array<{ name: string; versions: string[]; instanceCount: number }>;
  missingLockfile: boolean;
};

export type DeclaredDependency = {
  name: string;
  range: string;
  dependencyType: DependencyType;
};
