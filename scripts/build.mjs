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

/**
 * Resolve a path relative to the repository root.
 */
function p(...parts) {
  return path.join(root, ...parts);
}

/**
 * Run a native executable using the current Node process environment.
 *
 * We intentionally avoid `.cmd` shims on Windows because they can fail
 * with EINVAL on Windows ARM64 GitHub runners.
 */
function run(command, args = []) {
  console.log(`\n> ${command} ${args.join(" ")}`);

  execFileSync(command, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: false,
  });
}

/**
 * Run a JavaScript CLI through the current Node executable.
 *
 * This avoids Windows `.cmd` wrappers entirely.
 */
function runNodeScript(script, args = []) {
  run(process.execPath, [script, ...args]);
}

/**
 * Copy a file or directory.
 */
function copy(source, destination) {
  mkdirSync(path.dirname(destination), {
    recursive: true,
  });

  cpSync(source, destination, {
    recursive: true,
    force: true,
  });
}

/**
 * Resolve a dependency's executable JavaScript entry point.
 *
 * We do NOT use node_modules/.bin/*.cmd because Windows ARM64
 * runners can fail to spawn those wrappers with EINVAL.
 */
function dependencyBin(packageName, binPath) {
  return p(
    "node_modules",
    packageName,
    binPath,
  );
}

console.log("Building @vortiqlabs/codebase-indexer...");
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Node: ${process.version}`);

/* -------------------------------------------------------------------------- */
/* Clean                                                                      */
/* -------------------------------------------------------------------------- */

console.log("\nCleaning dist...");

rmSync(
  p("dist"),
  {
    recursive: true,
    force: true,
  },
);

/* -------------------------------------------------------------------------- */
/* TypeScript                                                                 */
/* -------------------------------------------------------------------------- */

console.log("\nCompiling TypeScript...");

const tsc = dependencyBin(
  "typescript",
  path.join("bin", "tsc"),
);

if (!existsSync(tsc)) {
  throw new Error(
    `TypeScript compiler not found: ${tsc}`,
  );
}

runNodeScript(
  tsc,
  [
    "-p",
    "tsconfig.json",
  ],
);

/* -------------------------------------------------------------------------- */
/* Runtime directories                                                        */
/* -------------------------------------------------------------------------- */

console.log("\nPreparing runtime directories...");

mkdirSync(
  p("dist", "grammars"),
  { recursive: true },
);

mkdirSync(
  p("dist", "tree-sitter-wasms"),
  { recursive: true },
);

mkdirSync(
  p("dist", "workers"),
  { recursive: true },
);

mkdirSync(
  p("dist", "dashboard"),
  { recursive: true },
);

/* -------------------------------------------------------------------------- */
/* Tree-sitter grammars                                                       */
/* -------------------------------------------------------------------------- */

console.log("\nCopying Tree-sitter grammars...");

copy(
  p(
    "src",
    "parser",
    "grammars",
  ),
  p(
    "dist",
    "grammars",
  ),
);

/* -------------------------------------------------------------------------- */
/* Tree-sitter WASM grammars                                                  */
/* -------------------------------------------------------------------------- */

console.log("\nCopying Tree-sitter WASM grammars...");

copy(
  p(
    "node_modules",
    "tree-sitter-wasms",
    "out",
  ),
  p(
    "dist",
    "tree-sitter-wasms",
  ),
);

/* -------------------------------------------------------------------------- */
/* web-tree-sitter runtime WASM                                               */
/* -------------------------------------------------------------------------- */

console.log("\nCopying web-tree-sitter runtime...");

const treeSitterWasm = p(
  "node_modules",
  "web-tree-sitter",
  "tree-sitter.wasm",
);

if (!existsSync(treeSitterWasm)) {
  throw new Error(
    [
      "Could not find web-tree-sitter runtime:",
      treeSitterWasm,
    ].join(" "),
  );
}

copy(
  treeSitterWasm,
  p(
    "dist",
    "workers",
    "tree-sitter.wasm",
  ),
);

/* -------------------------------------------------------------------------- */
/* esbuild                                                                    */
/* -------------------------------------------------------------------------- */

console.log("\nPreparing esbuild...");

const esbuild = dependencyBin(
  "esbuild",
  path.join("bin", "esbuild"),
);

if (!existsSync(esbuild)) {
  throw new Error(
    `esbuild executable not found: ${esbuild}`,
  );
}

function esbuildRun(args) {
  runNodeScript(
    esbuild,
    args,
  );
}

/* -------------------------------------------------------------------------- */
/* GitHub index worker                                                        */
/* -------------------------------------------------------------------------- */

console.log("\nBundling GitHub index worker...");

esbuildRun([
  "src/github/GitHubIndexPartWorker.ts",
  "--bundle",
  "--platform=node",
  "--target=node24",
  "--format=esm",
  "--outfile=dist/workers/GitHubIndexPartWorker.js",
]);

/* -------------------------------------------------------------------------- */
/* Dashboard index worker                                                    */
/* -------------------------------------------------------------------------- */

console.log("\nBundling dashboard index worker...");

esbuildRun([
  "src/dashboard/IndexSnapshotWorker.ts",
  "--bundle",
  "--platform=node",
  "--target=node24",
  "--format=esm",
  "--outfile=dist/workers/IndexSnapshotWorker.js",
]);

/* -------------------------------------------------------------------------- */
/* Dashboard graph client                                                     */
/* -------------------------------------------------------------------------- */

console.log("\nBundling dashboard graph client...");

esbuildRun([
  "src/dashboard/graph-client.js",
  "--bundle",
  "--minify",
  "--format=iife",
  "--platform=browser",
  "--outfile=dist/dashboard/graph-client.js",
]);

/* -------------------------------------------------------------------------- */
/* Monaco                                                                     */
/* -------------------------------------------------------------------------- */

console.log("\nCopying Monaco editor...");

mkdirSync(
  p(
    "dist",
    "dashboard",
    "monaco",
  ),
  {
    recursive: true,
  },
);

copy(
  p(
    "node_modules",
    "monaco-editor",
    "min",
    "vs",
  ),
  p(
    "dist",
    "dashboard",
    "monaco",
    "vs",
  ),
);

/* -------------------------------------------------------------------------- */
/* Finished                                                                   */
/* -------------------------------------------------------------------------- */

console.log("\n✓ Build completed successfully.");
console.log(`Platform: ${process.platform}`);
console.log(`Architecture: ${process.arch}`);
console.log(`Output: ${p("dist")}`);