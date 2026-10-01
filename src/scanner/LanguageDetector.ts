import path from 'node:path';

const extensions: Record<string, string> = {
  '.c': 'c',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.css': 'css',
  '.dart': 'dart',
  '.el': 'elisp',
  '.elm': 'elm',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.go': 'go',
  '.h': 'c',
  '.hpp': 'cpp',
  '.htm': 'html',
  '.html': 'html',
  '.java': 'java',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.json': 'json',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.md': 'markdown',
  '.mdx': 'markdown',
  '.lua': 'lua',
  '.m': 'objectivec',
  '.mm': 'objectivec',
  '.ml': 'ocaml',
  '.mli': 'ocaml',
  '.php': 'php',
  '.py': 'python',
  '.rb': 'ruby',
  '.rs': 'rust',
  '.ql': 'ql',
  '.res': 'rescript',
  '.scala': 'scala',
  '.sc': 'scala',
  '.sol': 'solidity',
  '.sh': 'bash',
  '.sql': 'sql',
  '.swift': 'swift',
  '.tla': 'tlaplus',
  '.toml': 'toml',
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.vue': 'vue',
  '.zig': 'zig',
  '.rdl': 'systemrdl'
};

export function detectLanguage(filePath: string): string {
  const name = path.basename(filePath).toLowerCase();
  if (name === 'dockerfile') return 'dockerfile';
  if (name === 'makefile') return 'makefile';
  if (name === '.gitignore') return 'gitignore';
  return extensions[path.extname(name)] ?? 'text';
}