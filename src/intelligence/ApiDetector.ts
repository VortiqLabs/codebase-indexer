import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import type { IndexSnapshot } from '../storage/IndexFormat.js';

export interface ApiEndpoint {
  id: string;
  method: string;
  path: string;
  fileId: string;
  symbolId?: string;
  startLine: number;
  endLine: number;
}

export async function detectApiEndpoints(snapshot: IndexSnapshot): Promise<ApiEndpoint[]> {
  const endpoints: ApiEndpoint[] = [];
  const symbolByFile = new Map<string, Set<string>>();
  for (const symbol of snapshot.symbols) {
    const set = symbolByFile.get(symbol.filePath) ?? new Set<string>();
    set.add(symbol.name);
    symbolByFile.set(symbol.filePath, set);
  }

  for (const file of snapshot.files) {
    const source = await readFile(path.join(snapshot.metadata.workspaceRoot, file.path), 'utf8').catch(() => '');
    if (!source) continue;

    const patterns = [
      /(?:app|router|server|fastify|api)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`](.+?)['"`]/giu,
      /@(?:Get|Post|Put|Delete|Patch|RequestMapping|GetMapping|PostMapping)\s*\(\s*['"`](.+?)['"`]/giu,
      /(?:route|router)\s*\(\s*['"`](.+?)['"`]/giu,
      /(?:path|r)\.(get|post|put|delete|patch|options|head)\s*\(\s*['"`](.+?)['"`]/giu,
      /\b(?:@app|@bp)\.(?:route|get|post|put|delete|patch)\s*\(\s*['"`](.+?)['"`]/giu,
      /\[(?:HttpGet|HttpPost|HttpPut|HttpDelete|HttpPatch)\]\s*(?:async\s+)?(?:function\s+)?([A-Za-z0-9_]+)/giu
    ];

    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const method = String(match[1] ?? 'GET').toUpperCase();
        const route = String(match[2] ?? match[0] ?? '/').trim();
        if (!route.startsWith('/') && !route.startsWith('http') && !route.startsWith('{')) {
          continue;
        }
        const line = source.slice(0, match.index ?? 0).split('\n').length;
        const l = route || '/';
        const symbolId = [...(symbolByFile.get(file.path) ?? [])].find((name) => source.slice(0, match.index ?? 0).includes(name));
        endpoints.push({
          id: createHash('sha256').update(`${file.path}:${method}:${l}:${line}`).digest('hex').slice(0, 24),
          method,
          path: l,
          fileId: file.path,
          ...(symbolId ? { symbolId } : {}),
          startLine: line,
          endLine: line + 1
        });
      }
    }
  }

  return endpoints;
}
