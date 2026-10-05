import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { IndexSnapshot } from '../storage/IndexFormat.js';

export interface DatabaseField {
  name: string;
  type: string;
  isPrimary?: boolean;
  isNullable?: boolean;
}

export interface DatabaseModelInfo {
  name: string;
  kind: 'prisma' | 'sql' | 'orm' | 'migration';
  filePath: string;
  tableOrModel: string;
  fields: DatabaseField[];
}

export async function analyzeDatabaseSchema(snapshot: IndexSnapshot): Promise<DatabaseModelInfo[]> {
  const models: DatabaseModelInfo[] = [];

  for (const file of snapshot.files) {
    const lower = file.path.toLowerCase();
    const fullPath = path.join(snapshot.metadata.workspaceRoot, file.path);

    if (lower.endsWith('.prisma')) {
      const source = await readFile(fullPath, 'utf8').catch(() => '');
      const modelRegex = /model\s+([A-Za-z0-9_]+)\s*\{([^}]+)\}/gu;
      for (const match of source.matchAll(modelRegex)) {
        const modelName = match[1]!;
        const body = match[2]!;
        const fields: DatabaseField[] = [];
        for (const line of body.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;
          const parts = trimmed.split(/\s+/u);
          if (parts.length >= 2) {
            const fName = parts[0]!;
            const fType = parts[1]!;
            fields.push({
              name: fName,
              type: fType.replace('?', ''),
              isPrimary: trimmed.includes('@id'),
              isNullable: fType.endsWith('?')
            });
          }
        }
        models.push({
          name: modelName,
          kind: 'prisma',
          filePath: file.path,
          tableOrModel: modelName,
          fields
        });
      }
    } else if (lower.endsWith('.sql') || lower.includes('/migrations/') || lower.includes('/migrate/')) {
      const source = await readFile(fullPath, 'utf8').catch(() => '');
      const tableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"]?[A-Za-z0-9_.]+(?:\[[^\]]+\])?[`"]?)\s*\(([^;]+)\);/giu;
      for (const match of source.matchAll(tableRegex)) {
        const tableName = match[1]!.replace(/[`"\[\]]/gu, '');
        const body = match[2]!;
        const fields: DatabaseField[] = [];
        for (const line of body.split('\n')) {
          const trimmed = line.trim().replace(/,$/u, '');
          if (!trimmed || trimmed.startsWith('--') || trimmed.toUpperCase().startsWith('PRIMARY KEY') || trimmed.toUpperCase().startsWith('FOREIGN KEY')) continue;
          const parts = trimmed.split(/\s+/u);
          if (parts.length >= 2) {
            fields.push({
              name: parts[0]!.replace(/[`"]/gu, ''),
              type: parts[1]!.toUpperCase(),
              isPrimary: trimmed.toUpperCase().includes('PRIMARY KEY'),
              isNullable: !trimmed.toUpperCase().includes('NOT NULL')
            });
          }
        }
        models.push({
          name: tableName,
          kind: 'sql',
          filePath: file.path,
          tableOrModel: tableName,
          fields
        });
      }
    } else if (lower.includes('model') || lower.includes('entity') || lower.includes('schema')) {
      const symbols = snapshot.symbols.filter((s) => s.filePath === file.path && (s.kind === 'class' || s.kind === 'interface'));
      for (const sym of symbols) {
        models.push({
          name: sym.name,
          kind: 'orm',
          filePath: file.path,
          tableOrModel: sym.name,
          fields: []
        });
      }
    }
  }

  return models;
}
