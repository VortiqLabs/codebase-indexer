import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createCodebaseIndexerMcpServer } from '../src/mcp/CodebaseIndexerMcpServer.js';

test('MCP server exposes tools for indexing, discovery, search, and source reading', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-mcp-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  await mkdir(workspace);
  await writeFile(path.join(workspace, 'service.ts'), 'export function mcpSample() { return "indexed"; }\n');

  const server = createCodebaseIndexerMcpServer({ indexDir });
  const client = new Client({ name: 'codebase-indexer-test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);

    const toolList = await client.listTools();
    const toolNames = toolList.tools.map((tool) => tool.name);
    assert.ok(toolNames.includes('index_github_repository'));
    assert.ok(toolNames.includes('search_code'));

    const indexed = await client.callTool({
      name: 'index_local_workspace',
      arguments: { workspacePath: workspace }
    });
    const indexResult = JSON.parse(toolText(indexed)) as { uid: string; fileCount: number };
    assert.equal(indexResult.fileCount, 1);

    const indexes = await client.callTool({ name: 'list_indexes', arguments: {} });
    const indexList = JSON.parse(toolText(indexes)) as {
      indexes: Array<{ metadata: { uid: string } }>;
    };
    assert.equal(indexList.indexes[0]?.metadata.uid, indexResult.uid);

    const search = await client.callTool({ name: 'search_code', arguments: { query: 'mcpSample' } });
    const searchResults = JSON.parse(toolText(search)) as Array<{ filePath: string }>;
    assert.equal(searchResults[0]?.filePath, 'service.ts');

    const source = await client.callTool({
      name: 'read_indexed_file',
      arguments: { indexUid: indexResult.uid, filePath: 'service.ts' }
    });
    const sourceResult = JSON.parse(toolText(source)) as { content: string };
    assert.match(sourceResult.content, /function mcpSample/u);
  } finally {
    await client.close();
    await server.close();
    await rm(temporary, { recursive: true, force: true });
  }
});

function toolText(result: unknown): string {
  assert.ok(typeof result === 'object' && result !== null && 'content' in result);
  const content = result.content;
  assert.ok(Array.isArray(content));
  const first: unknown = content[0];
  assert.ok(typeof first === 'object' && first !== null && 'text' in first);
  const text = first.text;
  if (typeof text !== 'string') throw new Error('MCP tool returned non-text content');
  return text;
}