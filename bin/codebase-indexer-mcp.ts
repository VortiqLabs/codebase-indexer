#!/usr/bin/env node
import { startCodebaseIndexerMcpServer } from '../src/mcp/CodebaseIndexerMcpServer.js';

startCodebaseIndexerMcpServer().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});