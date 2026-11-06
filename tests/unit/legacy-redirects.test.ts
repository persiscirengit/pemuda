import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("Legacy URL 301 Redirects Specification", () => {
  it("configures permanent 301 redirects for legacy Laravel monolith routes in next.config.ts", async () => {
    const configPath = path.resolve(process.cwd(), "next.config.ts");
    expect(fs.existsSync(configPath)).toBe(true);

    const configModule = await import(configPath);
    const configExport = configModule.default;
    const config =
      typeof configExport === "function"
        ? await configExport("phase-production-build", {})
        : configExport;

    expect(typeof config.redirects).toBe("function");
    const redirects = await config.redirects();

    const expectedRules = [
      { source: "/artikel", destination: "/articles", permanent: true },
      {
        source: "/artikel/:slug",
        destination: "/articles/:slug",
        permanent: true,
      },
      { source: "/kajian", destination: "/articles", permanent: true },
      {
        source: "/kajian/:slug",
        destination: "/articles/:slug",
        permanent: true,
      },
      {
        source: "/kategori/:slug",
        destination: "/articles?category=:slug",
        permanent: true,
      },
    ];

    for (const rule of expectedRules) {
      const match = redirects.find(
        (r: { source: string; destination: string; permanent: boolean }) =>
          r.source === rule.source,
      );
      expect(match).toBeDefined();
      expect(match?.destination).toBe(rule.destination);
      expect(match?.permanent).toBe(true);
    }
  });
});
