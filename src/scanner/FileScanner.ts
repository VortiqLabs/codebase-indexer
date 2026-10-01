import { open, readdir, readFile, realpath, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { IgnoreMatcher, type IgnoreMatcherOptions } from './IgnoreMatcher.js';
import { detectLanguage } from './LanguageDetector.js';
import type { FileRecord, ScanError, ScanResult } from '../types/FileRecord.js';

export interface FileScannerOptions extends IgnoreMatcherOptions {
  maxFileSize?: number;
  includeFiles?: string[];
}

export interface ScannedFilePath {
  path: string;
  size: number;
}

const DEFAULT_MAX_FILE_SIZE = 1024 * 1024;
const BINARY_SAMPLE_SIZE = 8192;
const TOKEN_PATTERN = /[\p{L}\p{N}_$.-]+/gu;

export class FileScanner {
  private readonly root: string;
  private readonly maxFileSize: number;
  private readonly matcher: IgnoreMatcher;
  private readonly includeFiles: Set<string> | undefined;
  private readonly includedDirectories: Set<string> | undefined;

  private constructor(root: string, maxFileSize: number, matcher: IgnoreMatcher, includeFiles?: string[]) {
    this.root = root;
    this.maxFileSize = maxFileSize;
    this.matcher = matcher;
    this.includeFiles = includeFiles ? new Set(includeFiles) : undefined;
    this.includedDirectories = includeFiles ? collectParentDirectories(includeFiles) : undefined;
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
    return new FileScanner(root, maxFileSize, matcher, options.includeFiles);
  }

  async scan(onProgress?: (visitedFiles: number, acceptedFiles: number) => void): Promise<ScanResult> {
    const files: FileRecord[] = [];
    const errors: ScanError[] = [];
    let visitedFiles = 0;
    await this.walk('', files, errors, this.matcher, () => {
      visitedFiles++;
      if (visitedFiles === 1 || visitedFiles % 250 === 0) onProgress?.(visitedFiles, files.length);
    });
    files.sort((left, right) => left.path.localeCompare(right.path));
    onProgress?.(visitedFiles, files.length);
    return { files, errors };
  }

  async listFiles(onProgress?: (visitedFiles: number, candidateFiles: number) => void): Promise<{
    files: ScannedFilePath[];
    errors: ScanError[];
  }> {
    const files: ScannedFilePath[] = [];
    const errors: ScanError[] = [];
    let visitedFiles = 0;
    await this.walkPaths('', files, errors, this.matcher, () => {
      visitedFiles++;
      if (visitedFiles === 1 || visitedFiles % 500 === 0) onProgress?.(visitedFiles, files.length);
    });
    files.sort((left, right) => left.path.localeCompare(right.path));
    onProgress?.(visitedFiles, files.length);
    return { files, errors };
  }

  private async walk(
    relativeDirectory: string,
    files: FileRecord[],
    errors: ScanError[],
    matcher: IgnoreMatcher = this.matcher,
    onFileVisited?: () => void
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
        if (this.includedDirectories && !this.includedDirectories.has(relativePath.split(path.sep).join('/'))) continue;
        try {
          await this.walk(relativePath, files, errors, await matcher.forDirectory(relativePath), onFileVisited);
        } catch (error) {
          errors.push({ path: relativePath, message: errorMessage(error) });
        }
      } else if (entry.isFile()) {
        await this.addFile(relativePath, files, errors);
        onFileVisited?.();
      }
    }
  }

  private async walkPaths(
    relativeDirectory: string,
    files: ScannedFilePath[],
    errors: ScanError[],
    matcher: IgnoreMatcher,
    onFileVisited?: () => void
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
      if (entry.isSymbolicLink() || matcher.ignores(relativePath, entry.isDirectory())) continue;
      if (entry.isDirectory()) {
        try {
          await this.walkPaths(relativePath, files, errors, await matcher.forDirectory(relativePath), onFileVisited);
        } catch (error) {
          errors.push({ path: relativePath, message: errorMessage(error) });
        }
        continue;
      }
      if (!entry.isFile()) continue;
      onFileVisited?.();
      try {
        const absolutePath = path.join(this.root, relativePath);
        const fileStats = await stat(absolutePath);
        if (fileStats.size > this.maxFileSize) continue;
        const handle = await open(absolutePath, 'r');
        try {
          const sample = Buffer.alloc(Math.min(BINARY_SAMPLE_SIZE, fileStats.size));
          if (sample.length > 0) await handle.read(sample, 0, sample.length, 0);
          if (sample.includes(0)) continue;
        } finally {
          await handle.close();
        }
        files.push({ path: relativePath.split(path.sep).join('/'), size: fileStats.size });
      } catch (error) {
        errors.push({ path: relativePath, message: errorMessage(error) });
      }
    }
  }

  private async addFile(relativePath: string, files: FileRecord[], errors: ScanError[]): Promise<void> {
    if (this.includeFiles && !this.includeFiles.has(relativePath.split(path.sep).join('/'))) return;
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

function collectParentDirectories(filePaths: string[]): Set<string> {
  const directories = new Set<string>();
  for (const filePath of filePaths) {
    const parts = filePath.split('/');
    parts.pop();
    let current = '';
    for (const part of parts) {
      current = current ? `${current}/${part}` : part;
      directories.add(current.split(path.sep).join('/'));
    }
  }
  return directories;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}