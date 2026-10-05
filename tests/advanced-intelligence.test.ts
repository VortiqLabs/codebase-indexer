import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { CodebaseIndexer } from '../src/core/CodebaseIndexer.js';
import { createCodebaseIndexerMcpServer } from '../src/mcp/CodebaseIndexerMcpServer.js';

test('advanced intelligence: impact analysis, test mapping, database, complexity, explain symbol, and MCP tools', async () => {
  const temporary = await mkdtemp(path.join(os.tmpdir(), 'codebase-indexer-adv-test-'));
  const workspace = path.join(temporary, 'workspace');
  const indexDir = path.join(temporary, 'indexes');
  await mkdir(path.join(workspace, 'src'), { recursive: true });
  await mkdir(path.join(workspace, 'tests'), { recursive: true });

  await writeFile(
    path.join(workspace, 'schema.prisma'),
    'model User {\n  id String @id\n  email String?\n}\n'
  );

  await writeFile(
    path.join(workspace, 'src', 'user.ts'),
    'export class UserService {\n  createUser() { return "user"; }\n}\n'
  );

  await writeFile(
    path.join(workspace, 'src', 'app.ts'),
    'import { UserService } from "./user.js";\nexport function startApp() { const service = new UserService(); service.createUser(); }\napp.get("/users", () => "ok");\n'
  );

  await writeFile(
    path.join(workspace, 'tests', 'user.test.ts'),
    'import { UserService } from "../src/user.js";\nfunction testUser() { const service = new UserService(); service.createUser(); }\n'
  );

  const indexer = new CodebaseIndexer({ workspacePath: workspace, indexDir });
  await indexer.initialize();
  await indexer.index();

  // 1. Impact Analysis
  const impact = await indexer.analyzeImpact('UserService');
  assert.ok(impact.target === 'UserService');
  assert.ok(impact.directDependents.some((d) => d.filePath.includes('app.ts') || d.filePath.includes('user.test.ts')));

  // 2. Test Mapping
  const tests = await indexer.findTests('UserService');
  assert.ok(tests.some((t) => t.testFile.includes('user.test.ts')));

  const affectedTests = await indexer.findAffectedTests(['src/user.ts']);
  assert.ok(affectedTests.some((t) => t.testFile.includes('user.test.ts')));

  // 3. Database Schema
  const dbSchema = await indexer.getDatabaseSchema();
  assert.ok(dbSchema.some((m) => m.name === 'User' && m.kind === 'prisma'));

  // 4. Complexity
  const complexity = await indexer.getComplexity();
  assert.ok(complexity.length > 0);

  // 5. Explain Symbol
  const explanation = await indexer.explainSymbol('UserService');
  assert.equal(explanation.symbolName, 'UserService');
  assert.ok(explanation.isExported);

  // 6. MCP Server Tools
  const mcpServer = createCodebaseIndexerMcpServer({ indexDir });
  assert.ok(mcpServer);

  await rm(temporary, { recursive: true, force: true });
});
