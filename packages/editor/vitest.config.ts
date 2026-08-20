import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@/plane-editor": path.resolve(__dirname, "./src/ce"),
      "@/styles": path.resolve(__dirname, "./src/styles"),
      "@": path.resolve(__dirname, "./src/core"),
      src: path.resolve(__dirname, "./src"),
    },
  },
});
