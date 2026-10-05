import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitCommit {
  hash: string;
  author: string;
  date: string;
  subject: string;
}

export interface GitChangedFile {
  code: string;
  filePath: string;
}

export interface GitHistoryResult {
  isGit: boolean;
  branch: string;
  commits: GitCommit[];
  changedFiles: GitChangedFile[];
}

export async function getGitHistory(workspaceRoot: string, limit = 20): Promise<GitHistoryResult> {
  try {
    const { stdout: status } = await execFileAsync('git', ['status', '--porcelain'], { cwd: workspaceRoot });
    const { stdout: branch } = await execFileAsync('git', ['branch', '--show-current'], { cwd: workspaceRoot });
    const { stdout: log } = await execFileAsync('git', ['log', `-n`, String(limit), '--pretty=format:%h|%an|%ar|%s'], { cwd: workspaceRoot });

    const commits = log.split('\n').filter(Boolean).map((line) => {
      const parts = line.split('|');
      return {
        hash: parts[0] || '',
        author: parts[1] || '',
        date: parts[2] || '',
        subject: parts[3] || ''
      };
    });

    const changedFiles = status.split('\n').filter(Boolean).map((line) => {
      return {
        code: line.slice(0, 2).trim(),
        filePath: line.slice(3).trim()
      };
    });

    return {
      isGit: true,
      branch: branch.trim() || 'main',
      commits,
      changedFiles
    };
  } catch {
    return {
      isGit: false,
      branch: 'N/A',
      commits: [],
      changedFiles: []
    };
  }
}
