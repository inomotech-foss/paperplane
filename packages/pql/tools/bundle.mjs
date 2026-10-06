// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { gzipSync } from "node:zlib";

import { build } from "esbuild";

async function measure(label, external) {
  const result = await build({
    entryPoints: ["src/index.ts"],
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2022",
    write: false,
    external,
  });
  const code = result.outputFiles[0].contents;
  const gz = gzipSync(code, { level: 9 }).length;
  console.log(`${label}: raw ${(code.length / 1024).toFixed(1)} KB, gzip ${(gz / 1024).toFixed(1)} KB`);
}

await measure("package with antlr4ng and antlr4-c3, CodeMirror external", ["@codemirror/*", "@lezer/*"]);
await measure("package with every dependency", []);
