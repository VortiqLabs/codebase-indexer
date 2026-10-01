export type RelationKind = 'imports' | 'exports' | 'calls' | 'extends' | 'implements' | 'references' | 'contains';

export interface RelationRecord {
  id: string;
  kind: RelationKind;
  filePath: string;
  fromSymbolId?: string;
  toSymbolId?: string;
  targetName: string;
  line: number;
  confidence: number;
}