import { readdir, readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { IgnoreMatcher, type IgnoreMatcherOptions } from './IgnoreMatcher.js';
import { detectLanguage } from './LanguageDetector.js';
import type { FileRecord, ScanError, ScanResult } from '../types/FileRecord.js';

export interface FileScannerOptions extends IgnoreMatcherOptions {
  maxFileSize?: number;
}

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;
const BINARY_SAMPLE_SIZE = 8192;
const TOKEN_PATTERN = /[\p{L}\p{N}_$.-]+/gu;

export class FileScanner {
  private readonly root: string;
  private readonly maxFileSize: number;
  private readonly matcher: IgnoreMatcher;

  private constructor(root: string, maxFileSize: number, matcher: IgnoreMatcher) {
    this.root = root;
    this.maxFileSize = maxFileSize;
    this.matcher = matcher;
  }

  static async create(workspacePath: string, options: FileScannerOptions = {}): Promise<FileScanner> {
    const root = await realpath(workspacePath);
    const rootStats = await stat(root);
    if (!rootStats.isDirectory()) throw new Error(`Workspace is not a directory: ${workspacePath}`);
    const maxFileSize = options.maxFileSize ?? DEFAULT_MAX_FILE_SIZE;
    if (!Number.isSafeInteger(maxFileSize) || maxFileSize < 1) {
      throw new Error('maxFileSize must be a positive safe integer');
    }
    const matcher = await IgnoreMatcher.create(root, options);
    return new FileScanner(root, maxFileSize, matcher);
  }

  async scan(): Promise<ScanResult> {
    const files: FileRecord[] = [];
    const errors: ScanError[] = [];
    await this.walk('', files, errors);
    files.sort((left, right) => left.path.localeCompare(right.path));
    return { files, errors };
  }

  private async walk(
    relativeDirectory: string,
    files: FileRecord[],
    errors: ScanError[],
    matcher: IgnoreMatcher = this.matcher
  ): Promise<void> {
    let entries;
    try {
      entries = await readdir(path.join(this.root, relativeDirectory), { withFileTypes: true });
    } catch (error) {
      errors.push({ path: relativeDirectory || '.', message: errorMessage(error) });
      return;
    }

    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relativePath = path.join(relativeDirectory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (matcher.ignores(relativePath, entry.isDirectory())) continue;
      if (entry.isDirectory()) {
        try {
          await this.walk(relativePath, files, errors, await matcher.forDirectory(relativePath));
        } catch (error) {
          errors.push({ path: relativePath, message: errorMessage(error) });
        }
      } else if (entry.isFile()) {
        await this.addFile(relativePath, files, errors);
      }
    }
  }

  private async addFile(relativePath: string, files: FileRecord[], errors: ScanError[]): Promise<void> {
    const absolutePath = path.join(this.root, relativePath);
    try {
      const fileStats = await stat(absolutePath);
      if (fileStats.size > this.maxFileSize) return;
      const contents = await readFile(absolutePath);
      if (contents.subarray(0, BINARY_SAMPLE_SIZE).includes(0)) return;
      const source = contents.toString('utf8');
      const terms = [...new Set(source.match(TOKEN_PATTERN)?.map((term) => term.toLowerCase()) ?? [])];
      files.push({
        path: relativePath.split(path.sep).join('/'),
        language: detectLanguage(relativePath),
        hash: createHash('sha256').update(contents).digest('hex'),
        size: fileStats.size,
        modifiedAt: fileStats.mtimeMs,
        terms
      });
    } catch (error) {
      errors.push({ path: relativePath, message: errorMessage(error) });
    }
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}