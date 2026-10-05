import path from 'node:path';

import { fileURLToPath } from 'node:url';

export function runtimeRoot(): string {
  // Explicit override — useful for development/testing.
  const configuredRoot = process.env.CODEBASE_INDEXER_RUNTIME_ROOT;

  if (configuredRoot) {
    return path.resolve(configuredRoot);
  }

  try {
    const metaUrl = import.meta.url;
    if (metaUrl) {
      const currentDir = path.dirname(fileURLToPath(metaUrl));
      return path.resolve(currentDir, '..', '..');
    }
  } catch {
    // Fallback
  }

  if (process.argv[1] !== undefined) {
    return path.resolve(path.dirname(process.argv[1]), '..');
  }

  return path.dirname(process.execPath);
}

export function runtimePath(...parts: string[]): string {
  return path.join(runtimeRoot(), ...parts);
}