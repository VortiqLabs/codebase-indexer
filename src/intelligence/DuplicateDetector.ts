import type { IndexSnapshot } from '../storage/IndexFormat.js';

export interface DuplicateMatch {
  chunkId1: string;
  filePath1: string;
  startLine1: number;
  endLine1: number;
  chunkId2: string;
  filePath2: string;
  startLine2: number;
  endLine2: number;
  similarity: number;
  type: 'EXACT' | 'NORMALIZED' | 'STRUCTURAL';
  excerpt: string;
}

export function detectDuplicates(snapshot: IndexSnapshot, minLines = 3): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];

  const chunks = snapshot.chunks.filter((c) => c.endLine - c.startLine + 1 >= minLines);
  const hashGroups = new Map<string, typeof chunks>();

  for (const chunk of chunks) {
    const list = hashGroups.get(chunk.hash) ?? [];
    list.push(chunk);
    hashGroups.set(chunk.hash, list);
  }

  for (const group of hashGroups.values()) {
    if (group.length <= 1) continue;

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const c1 = group[i]!;
        const c2 = group[j]!;
        if (c1.filePath === c2.filePath && c1.startLine === c2.startLine) continue;

        matches.push({
          chunkId1: c1.id,
          filePath1: c1.filePath,
          startLine1: c1.startLine,
          endLine1: c1.endLine,
          chunkId2: c2.id,
          filePath2: c2.filePath,
          startLine2: c2.startLine,
          endLine2: c2.endLine,
          similarity: 1.0,
          type: 'EXACT',
          excerpt: c1.text.slice(0, 200)
        });
      }
    }
  }

  return matches;
}
