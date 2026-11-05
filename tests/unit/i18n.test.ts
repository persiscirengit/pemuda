import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { routing } from "@/i18n/routing";
import middleware from "@/middleware";

function collectKeys(obj: unknown, prefix = ""): Map<string, string> {
  const map = new Map<string, string>();
  if (!obj || typeof obj !== "object") return map;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      for (const [childK, childV] of collectKeys(v, full)) {
        map.set(childK, childV);
      }
    } else {
      map.set(full, String(v));
    }
  }
  return map;
}

describe("i18n Routing Configuration", () => {
  it("defines supported locales with id-ID as default and never as prefix", () => {
    expect(routing.locales).toEqual(["id-ID", "en-US"]);
    expect(routing.defaultLocale).toBe("id-ID");
    expect(routing.localePrefix).toBe("never");
  });
});

describe("i18n Middleware", () => {
  it("resolves locale from cookie or defaults to id-ID", () => {
    // 1. Without cookie: defaults to id-ID and sets cookie
    const reqNoCookie = new NextRequest("http://localhost:3000/dashboard");
    const resNoCookie = middleware(reqNoCookie);
    const rewriteHeader = resNoCookie.headers.get("x-middleware-rewrite");
    const localeHeader =
      resNoCookie.headers.get("x-next-intl-locale") ||
      resNoCookie.headers.get("x-middleware-request-x-next-intl-locale");
    const setCookieHeader = resNoCookie.headers.get("set-cookie");

    expect(rewriteHeader).toContain("/id-ID");
    expect(localeHeader).toBe("id-ID");
    expect(setCookieHeader).toContain("NEXT_LOCALE=id-ID");

    // 2. With NEXT_LOCALE=en-US cookie: resolves to en-US
    const reqEnCookie = new NextRequest("http://localhost:3000/dashboard", {
      headers: { cookie: "NEXT_LOCALE=en-US" },
    });
    const resEnCookie = middleware(reqEnCookie);
    const rewriteEnHeader = resEnCookie.headers.get("x-middleware-rewrite");
    const localeEnHeader =
      resEnCookie.headers.get("x-next-intl-locale") ||
      resEnCookie.headers.get("x-middleware-request-x-next-intl-locale");

    expect(rewriteEnHeader).toContain("/en-US");
    expect(localeEnHeader).toBe("en-US");

    // 3. With unknown locale cookie: falls back to default id-ID
    const reqInvalidCookie = new NextRequest(
      "http://localhost:3000/dashboard",
      {
        headers: { cookie: "NEXT_LOCALE=fr-FR" },
      },
    );
    const resInvalidCookie = middleware(reqInvalidCookie);
    const rewriteInvalidHeader = resInvalidCookie.headers.get(
      "x-middleware-rewrite",
    );
    const localeInvalidHeader =
      resInvalidCookie.headers.get("x-next-intl-locale") ||
      resInvalidCookie.headers.get("x-middleware-request-x-next-intl-locale");

    expect(rewriteInvalidHeader).toContain("/id-ID");
    expect(localeInvalidHeader).toBe("id-ID");
  });
});

describe("Translation Key Parity and Structure", () => {
  const rootDir = process.cwd();
  const enPath = path.join(rootDir, "messages", "en-US.json");
  const idPath = path.join(rootDir, "messages", "id-ID.json");

  it("messages files exist for en-US and id-ID", () => {
    expect(fs.existsSync(enPath)).toBe(true);
    expect(fs.existsSync(idPath)).toBe(true);
  });

  it("maintains 100% recursive key parity and zero empty string values", () => {
    const enContent = JSON.parse(fs.readFileSync(enPath, "utf-8"));
    const idContent = JSON.parse(fs.readFileSync(idPath, "utf-8"));

    const enKeys = collectKeys(enContent);
    const idKeys = collectKeys(idContent);

    // Parity: all en keys in id
    for (const [key, value] of enKeys) {
      expect(idKeys.has(key)).toBe(true);
      expect(value.trim().length).toBeGreaterThan(0);
    }

    // Parity: all id keys in en
    for (const [key, value] of idKeys) {
      expect(enKeys.has(key)).toBe(true);
      expect(value.trim().length).toBeGreaterThan(0);
    }

    expect(enKeys.size).toBe(idKeys.size);
  });

  it("contains all required dictionary sections from specification", () => {
    const enContent = JSON.parse(fs.readFileSync(enPath, "utf-8"));

    // common
    expect(enContent.common?.appName).toBeDefined();
    expect(enContent.common?.organizationName).toBeDefined();
    const actions = [
      "save",
      "cancel",
      "edit",
      "delete",
      "search",
      "filter",
      "export",
      "import",
      "back",
      "close",
    ];
    for (const action of actions) {
      expect(enContent.common?.actions?.[action]).toBeDefined();
    }
    const statuses = ["active", "inactive", "loading", "error", "success"];
    for (const status of statuses) {
      expect(enContent.common?.status?.[status]).toBeDefined();
    }

    // auth
    const authKeys = [
      "loginTitle",
      "loginSubtitle",
      "emailOrNpaLabel",
      "passwordLabel",
      "signInButton",
      "signOutButton",
      "forgotPassword",
    ];
    for (const key of authKeys) {
      expect(enContent.auth?.[key]).toBeDefined();
    }

    // navigation
    const navKeys = [
      "dashboard",
      "organization",
      "members",
      "activities",
      "finance",
      "content",
      "notifications",
      "settings",
      "profile",
    ];
    for (const key of navKeys) {
      expect(enContent.navigation?.[key]).toBeDefined();
    }
  });
});
