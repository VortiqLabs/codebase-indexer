import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

function p(...parts) {
  return path.join(root, ...parts);
}

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false,
  });
}

function copy(source, destination) {
  mkdirSync(path.dirname(destination), { recursive: true });
  cpSync(source, destination, {
    recursive: true,
    force: true,
  });
}

console.log("Building @vortiqlabs/codebase-indexer...");

// Clean
rmSync(p("dist"), { recursive: true, force: true });

// TypeScript
run(process.platform === "win32" ? "npx.cmd" : "npx", [
  "tsc",
  "-p",
  "tsconfig.json",
]);

// Runtime directories
mkdirSync(p("dist", "grammars"), { recursive: true });
mkdirSync(p("dist", "tree-sitter-wasms"), { recursive: true });
mkdirSync(p("dist", "workers"), { recursive: true });
mkdirSync(p("dist", "dashboard"), { recursive: true });

// Parser grammars
copy(
  p("src", "parser", "grammars"),
  p("dist", "grammars")
);

// Tree-sitter WASMs
copy(
  p("node_modules", "tree-sitter-wasms", "out"),
  p("dist", "tree-sitter-wasms")
);

// web-tree-sitter runtime WASM
const treeSitterWasm = p(
  "node_modules",
  "web-tree-sitter",
  "tree-sitter.wasm"
);

if (!existsSync(treeSitterWasm)) {
  throw new Error(
    `Could not find web-tree-sitter runtime: ${treeSitterWasm}`
  );
}

copy(
  treeSitterWasm,
  p("dist", "workers", "tree-sitter.wasm")
);

// esbuild executable
const esbuild = process.platform === "win32"
  ? p("node_modules", ".bin", "esbuild.cmd")
  : p("node_modules", ".bin", "esbuild");

function esbuildRun(args) {
  run(esbuild, args);
}

// GitHub index worker
esbuildRun([
  "src/github/GitHubIndexPartWorker.ts",
  "--bundle",
  "--platform=node",
  "--target=node24",
  "--format=esm",
  "--outfile=dist/workers/GitHubIndexPartWorker.js",
]);

// Dashboard index worker
esbuildRun([
  "src/dashboard/IndexSnapshotWorker.ts",
  "--bundle",
  "--platform=node",
  "--target=node24",
  "--format=esm",
  "--outfile=dist/workers/IndexSnapshotWorker.js",
]);

// Dashboard graph client
esbuildRun([
  "src/dashboard/graph-client.js",
  "--bundle",
  "--minify",
  "--format=iife",
  "--platform=browser",
  "--outfile=dist/dashboard/graph-client.js",
]);

// Monaco
mkdirSync(p("dist", "dashboard", "monaco"), {
  recursive: true,
});

copy(
  p("node_modules", "monaco-editor", "min", "vs"),
  p("dist", "dashboard", "monaco", "vs")
);

console.log("\n✓ Build completed successfully.");