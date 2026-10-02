import type { IndexSnapshot } from '../storage/IndexFormat.js';

export interface RepositoryArea {
  name: string;
  path: string;
  kind: 'source' | 'test' | 'config' | 'docs' | 'infra' | 'unknown';
  files: number;
  symbols: number;
}

export interface RepositoryMap {
  root: string;
  areas: RepositoryArea[];
}

export function buildRepositoryMap(snapshot: IndexSnapshot): RepositoryMap {
  const areaCounts = new Map<string, RepositoryArea>();
  const symbolCounts = new Map<string, number>();

  for (const file of snapshot.files) {
    const area = normalizeArea(file.path);
    const entry = areaCounts.get(area.path) ?? {
      name: area.name,
      path: area.path,
      kind: area.kind,
      files: 0,
      symbols: 0
    };
    entry.files += 1;
    areaCounts.set(area.path, entry);
  }

  for (const symbol of snapshot.symbols) {
    const area = normalizeArea(symbol.filePath);
    const key = area.path;
    const current = symbolCounts.get(key) ?? 0;
    symbolCounts.set(key, current + 1);
    const entry = areaCounts.get(key);
    if (entry) entry.symbols = symbolCounts.get(key) ?? entry.symbols;
  }

  const areas = [...areaCounts.values()].sort((left, right) => right.files - left.files || left.path.localeCompare(right.path));
  return { root: snapshot.metadata.workspaceRoot, areas };
}

function normalizeArea(filePath: string): { name: string; path: string; kind: RepositoryArea['kind'] } {
  const normalized = filePath.split('/').filter(Boolean);
  const topLevel = normalized[0] ?? '.';
  const lower = filePath.toLowerCase();

  if (/(^|\/)(test|tests|__tests__|spec|specs)(\/|$)/u.test(filePath)) {
    return { name: topLevel === '.' ? 'tests' : topLevel, path: normalized.slice(0, 2).join('/') || topLevel, kind: 'test' };
  }
  if (/(?<![\w])(?:package\.json|tsconfig\.json|jsconfig\.json|pyproject\.toml|requirements\.txt|Cargo\.toml|go\.mod|pom\.xml|build\.gradle|CMakeLists\.txt|docker-compose\.|Dockerfile|\.env|eslint|prettier|vite|webpack|next|babel|rollup|turbo|nx).*$/iu.test(filePath)) {
    return { name: topLevel === '.' ? 'config' : topLevel, path: normalized.slice(0, 2).join('/') || topLevel, kind: 'config' };
  }
  if (/(^|\/)(docs?|documentation|readme|guides)(\/|$)/iu.test(filePath)) {
    return { name: topLevel === '.' ? 'docs' : topLevel, path: normalized.slice(0, 2).join('/') || topLevel, kind: 'docs' };
  }
  if (/(^|\/)(infra|infrastructure|deploy|ops|kubernetes|helm|docker|scripts|ci|cd|terraform)(\/|$)/iu.test(filePath)) {
    return { name: topLevel === '.' ? 'infra' : topLevel, path: normalized.slice(0, 2).join('/') || topLevel, kind: 'infra' };
  }

  const pathName = topLevel === '.' ? 'source' : topLevel;
  return {
    name: pathName,
    path: normalized.slice(0, 2).join('/') || topLevel,
    kind: lower.includes('src') || lower.includes('lib') || lower.includes('app') || lower.includes('pkg') ? 'source' : 'unknown'
  };
}
