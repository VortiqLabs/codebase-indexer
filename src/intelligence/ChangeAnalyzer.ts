import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface FileChangeCoupling {
  fileA: string;
  fileB: string;
  coChangeCount: number;
  totalCommits: number;
  couplingPercentage: number;
  description: string;
}

export interface Hotspot {
  filePath: string;
  commitCount: number;
  complexityScore?: number;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  explanation: string;
}

export async function analyzeChangeCoupling(workspaceRoot: string, limit = 50): Promise<FileChangeCoupling[]> {
  try {
    const { stdout: log } = await execFileAsync('git', ['log', `-n`, String(limit), '--name-only', '--pretty=format:---COMMIT---'], { cwd: workspaceRoot });
    const commits = log.split('---COMMIT---').filter(Boolean);

    const coChangeCounts = new Map<string, number>();
    let totalCommitCount = 0;

    for (const commitLog of commits) {
      const files = [...new Set(commitLog.split('\n').map((f) => f.trim()).filter((f) => f && !f.startsWith('---')))];
      if (files.length <= 1 || files.length > 30) continue; // skip bulk merges/renames
      totalCommitCount++;

      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          const pair = [files[i]!, files[j]!].sort();
          const key = `${pair[0]}::${pair[1]}`;
          coChangeCounts.set(key, (coChangeCounts.get(key) ?? 0) + 1);
        }
      }
    }

    if (totalCommitCount === 0) return [];

    const couplings: FileChangeCoupling[] = [];
    for (const [key, count] of coChangeCounts.entries()) {
      if (count < 2) continue; // filter low noise
      const [fileA, fileB] = key.split('::');
      if (!fileA || !fileB) continue;
      const couplingPercentage = Math.round((count / totalCommitCount) * 100);

      couplings.push({
        fileA,
        fileB,
        coChangeCount: count,
        totalCommits: totalCommitCount,
        couplingPercentage,
        description: `historical change coupling (${couplingPercentage}% of recent multi-file commits)`
      });
    }

    return couplings.sort((a, b) => b.couplingPercentage - a.couplingPercentage);
  } catch {
    return [];
  }
}

export async function detectHotspots(workspaceRoot: string, limit = 10): Promise<Hotspot[]> {
  try {
    const { stdout: log } = await execFileAsync('git', ['log', '-n', '100', '--name-only', '--pretty=format:'], { cwd: workspaceRoot });
    const fileCounts = new Map<string, number>();

    for (const line of log.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      fileCounts.set(trimmed, (fileCounts.get(trimmed) ?? 0) + 1);
    }

    const hotspots: Hotspot[] = [];
    for (const [filePath, count] of fileCounts.entries()) {
      const risk = count >= 15 ? 'HIGH' : count >= 7 ? 'MEDIUM' : 'LOW';
      hotspots.push({
        filePath,
        commitCount: count,
        risk,
        explanation: `${count} commits in recent history`
      });
    }

    return hotspots.sort((a, b) => b.commitCount - a.commitCount).slice(0, limit);
  } catch {
    return [];
  }
}
