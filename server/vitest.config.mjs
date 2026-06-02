import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: "./tests/setup.ts",
    coverage: {
      exclude: ["src/types.ts", "src/games/gameLogic.ts", "src/server.ts"],
    },
  },
});
