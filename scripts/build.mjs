import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

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
 * Run a JavaScript CLI through the current Node executable.
 *
 * We use this only for TypeScript because `tsc` is a JavaScript CLI.
 * This avoids Windows `.cmd` wrappers entirely.
 */
function runNodeScript(script, args = []) {
  console.log(`\n> ${process.execPath} ${script} ${args.join(" ")}`);

  execFileSync(
    process.execPath,
    [script, ...args],
    {
      cwd: root,
      stdio: "inherit",
      windowsHide: false,
    },
  );
}

/**
 * Copy a file or directory.
 */
function copy(source, destination) {
  mkdirSync(
    path.dirname(destination),
    {
      recursive: true,
    },
  );

  cpSync(
    source,
    destination,
    {
      recursive: true,
      force: true,
    },
  );
}

/**
 * Resolve a dependency's executable JavaScript entry point.
 *
 * We use this for TypeScript only.
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
  {
    recursive: true,
  },
);

mkdirSync(
  p("dist", "tree-sitter-wasms"),
  {
    recursive: true,
  },
);

mkdirSync(
  p("dist", "workers"),
  {
    recursive: true,
  },
);

mkdirSync(
  p("dist", "dashboard"),
  {
    recursive: true,
  },
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

console.log(
  `esbuild version: ${esbuild.version}`,
);

/**
 * Bundle using the esbuild JavaScript API.
 *
 * This is intentionally NOT executed through:
 *
 *   node_modules/.bin/esbuild
 *   esbuild/bin/esbuild
 *   npx esbuild
 *
 * The esbuild JS API handles the correct native binary for the
 * current platform and architecture.
 */
async function esbuildRun(options) {
  await esbuild.build(options);
}

/* -------------------------------------------------------------------------- */
/* GitHub index worker                                                        */
/* -------------------------------------------------------------------------- */

console.log("\nBundling GitHub index worker...");

await esbuildRun({
  entryPoints: [
    "src/github/GitHubIndexPartWorker.ts",
  ],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/workers/GitHubIndexPartWorker.js",
});

/* -------------------------------------------------------------------------- */
/* Dashboard index worker                                                     */
/* -------------------------------------------------------------------------- */

console.log("\nBundling dashboard index worker...");

await esbuildRun({
  entryPoints: [
    "src/dashboard/IndexSnapshotWorker.ts",
  ],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/workers/IndexSnapshotWorker.js",
});

/* -------------------------------------------------------------------------- */
/* Dashboard graph client                                                     */
/* -------------------------------------------------------------------------- */

console.log("\nBundling dashboard graph client...");

await esbuildRun({
  entryPoints: [
    "src/dashboard/graph-client.js",
  ],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  outfile: "dist/dashboard/graph-client.js",
});

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