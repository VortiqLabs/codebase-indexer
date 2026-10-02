import assert from 'node:assert/strict';
import test from 'node:test';
import { TreeSitterParser } from '../src/parser/TreeSitterParser.js';

test('Tree-sitter extracts TypeScript symbols, calls, imports, and semantic chunks', async () => {
  const parser = new TreeSitterParser();
  const parsed = await parser.parse('src/auth.ts', "import { token } from './token.js';\nconst secret = 'value';\nexport class AuthService extends BaseService implements Runnable {\n  login() { return token() + secret; }\n}\n", 'typescript');

  assert.ok(parsed);
  assert.ok(parsed.symbols.some((symbol) => symbol.name === 'AuthService' && symbol.kind === 'class'));
  assert.ok(parsed.symbols.some((symbol) => symbol.name === 'login' && symbol.kind === 'method'));
  assert.ok(parsed.relations.some((relation) => relation.kind === 'imports' && relation.targetName === './token.js'));
  assert.ok(parsed.relations.some((relation) => relation.kind === 'calls' && relation.targetName === 'token'));
  assert.ok(parsed.relations.some((relation) => relation.kind === 'exports' && relation.targetName === 'AuthService'));
  assert.ok(parsed.relations.some((relation) => relation.kind === 'extends' && relation.targetName === 'BaseService'));
  assert.ok(parsed.relations.some((relation) => relation.kind === 'implements' && relation.targetName === 'Runnable'));
  assert.ok(parsed.relations.some((relation) => relation.kind === 'contains' && relation.targetName === 'login'));
  assert.ok(parsed.relations.some((relation) => relation.kind === 'references' && relation.targetName === 'secret'));
  assert.ok(parsed.chunks.some((chunk) => chunk.text.includes('class AuthService')));
});

test('Tree-sitter loads every bundled grammar', async () => {
  const parser = new TreeSitterParser();
  const grammars: Array<[string, string]> = [
    ['bash', 'script.sh'], ['c', 'code.c'], ['cpp', 'code.cpp'], ['csharp', 'code.cs'],
    ['css', 'style.css'], ['dart', 'code.dart'], ['dockerfile', 'Dockerfile'],
    ['elisp', 'code.el'], ['elixir', 'code.ex'], ['elm', 'code.elm'], ['gitignore', '.gitignore'],
    ['go', 'code.go'], ['html', 'code.html'], ['java', 'code.java'],
    ['javascript', 'code.js'], ['json', 'code.json'], ['kotlin', 'code.kt'], ['lua', 'code.lua'],
    ['makefile', 'Makefile'], ['markdown', 'code.md'],
    ['objectivec', 'code.m'], ['ocaml', 'code.ml'], ['php', 'code.php'], ['python', 'code.py'],
    ['ql', 'code.ql'], ['rescript', 'code.res'], ['ruby', 'code.rb'], ['rust', 'code.rs'],
    ['scala', 'code.scala'], ['solidity', 'code.sol'], ['sql', 'code.sql'], ['swift', 'code.swift'],
    ['systemrdl', 'code.rdl'], ['tlaplus', 'code.tla'], ['toml', 'code.toml'],
    ['typescript', 'code.ts'], ['vue', 'code.vue'], ['yaml', 'code.yaml'], ['zig', 'code.zig']
  ];
  for (const [language, filePath] of grammars) {
    try {
      const parsed = await parser.parse(filePath, 'value', language);
      assert.ok(parsed, `failed to load ${language}`);
    } catch (error) {
      throw new Error(`${language}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  assert.ok(await parser.parse('component.tsx', 'export const View = () => <div />;', 'typescript'));
});