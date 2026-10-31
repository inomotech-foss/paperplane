import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths({ projects: [path.resolve(__dirname, "tsconfig.json")] })],
  test: {
    environment: "node",
    include: ["{helpers,services,store}/**/*.test.ts"],
  },
});
