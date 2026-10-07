import { defineConfig } from "vitest/config";
import path from "path";
import { loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    test: {
      environment: "node",
      globals: true,
      env: {
        ...env,
        // Unit tests must NEVER make real unmocked external calls to OpenRouter (§12)
        OPENROUTER_API_KEY: "",
      },
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./"),
      },
    },
  };
});
