// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const grammar = join(root, "apps/api/plane/utils/pql/PQL.g4");
const antlr = join(here, "../node_modules/.bin/antlr-ng");
const targets = {
  Python3: join(root, "apps/api/plane/utils/pql/generated"),
  TypeScript: join(here, "../src/generated"),
};

for (const [language, outDir] of Object.entries(targets)) {
  rmSync(outDir, { recursive: true, force: true });
  execFileSync(antlr, ["-D", `language=${language}`, "--generate-visitor", "-o", outDir, grammar], {
    stdio: "inherit",
    cwd: here,
  });
  for (const name of readdirSync(outDir)) {
    // Tool byproducts that neither runtime loads.
    if (name.endsWith(".interp") || name.endsWith(".tokens")) {
      rmSync(join(outDir, name));
    }
  }
  if (language === "Python3") {
    writeFileSync(join(outDir, "__init__.py"), "");
  }
}

// The "Generated from <absolute path>" stamp differs per machine, and the
// listener imports the ParseTreeListener interface as a value.
for (const outDir of Object.values(targets)) {
  for (const name of readdirSync(outDir)) {
    const path = join(outDir, name);
    const text = readFileSync(path, "utf8");
    const cleaned = text
      .replaceAll(grammar, "PQL.g4")
      .replace(/^import \{ ([^}]*ParseTreeListener[^}]*) \} from "antlr4ng";/m, 'import type { $1 } from "antlr4ng";');
    if (cleaned !== text) {
      writeFileSync(path, cleaned);
    }
  }
}
