import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    passWithNoTests: true,
    server: {
      deps: {
        inline: ["next-intl"],
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "next/server": path.resolve(
        import.meta.dirname,
        "./node_modules/next/server.js",
      ),
    },
  },
});
