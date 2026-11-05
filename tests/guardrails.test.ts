import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runGuardrails } from "../scripts/guardrails";

describe("Guardrails Engine (6 Laws)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pemuda-guardrail-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  function createFixture(files: Record<string, string>) {
    for (const [relativePath, content] of Object.entries(files)) {
      const fullPath = path.join(tempDir, relativePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, "utf-8");
    }
  }

  it("passes on a compliant minimal repository fixture", () => {
    createFixture({
      "package.json": JSON.stringify({
        name: "pemuda",
        dependencies: { next: "16.4.4", react: "19.3.1" },
        devDependencies: { typescript: "7.0.2" },
      }),
      ".env.example": "DATABASE_URL=\nSTORAGE_DRIVER=local\n",
      "src/app/page.tsx":
        'export default function Page() { return <main className="min-h-screen bg-slate-50" />; }\n',
      "src/app/layout.tsx":
        "export default function Layout({ children }: { children: React.ReactNode }) { return <html><body>{children}</body></html>; }\n",
    });

    const violations = runGuardrails(tempDir);
    expect(violations).toEqual([]);
  });

  it("flags raw HTML controls, modifier-prefixed arbitrary color classes, legacy ui/form imports, tailwind.config.*, and non-radix-nova components.json", () => {
    createFixture({
      "src/app/components-bad.tsx": `
        import { FormField } from "@/components/ui/form";
        export function Bad() {
          return (
            <div>
              <button type="submit">Submit</button>
              <input type="text" />
              <select><option value="1">1</option></select>
              <textarea />
              <table><tbody><tr><td>Cell</td></tr></tbody></table>
              <div className="hover:bg-[#10b981] dark:text-[rgb(15,23,42)]" />
            </div>
          );
        }
      `,
      "tailwind.config.js": "module.exports = {};\n",
      "components.json": JSON.stringify({ style: "default" }),
    });

    const violations = runGuardrails(tempDir);
    const law1Violations = violations.filter((v) => v.law === 1);
    expect(law1Violations.length).toBeGreaterThanOrEqual(5);

    const messages = law1Violations.map((v) => v.message);
    expect(messages.some((m) => m.includes("Raw HTML control <button>"))).toBe(
      true,
    );
    expect(messages.some((m) => m.includes("Raw HTML control <input>"))).toBe(
      true,
    );
    expect(
      messages.some((m) => m.includes("modifier-prefixed arbitrary color")),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("Legacy FormField / ui/form import")),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("tailwind.config.* is banned")),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes('components.json must use style "radix-nova"'),
      ),
    ).toBe(true);
  });

  it("flags JSX text, JSX string expressions, and literal UI attributes", () => {
    createFixture({
      "src/app/text-bad.tsx": `
        export function BadText() {
          return (
            <div>
              <span>Raw text is forbidden</span>
              <div>{"String expression is forbidden"}</div>
              <div>{\`Template literal expression is forbidden\`}</div>
              <input placeholder="Search" />
              <img alt="Avatar" />
              <button aria-label="Close" title="Tooltip" />
            </div>
          );
        }
      `,
    });

    const violations = runGuardrails(tempDir);
    const law2Violations = violations.filter((v) => v.law === 2);
    expect(law2Violations.length).toBeGreaterThanOrEqual(4);

    const messages = law2Violations.map((v) => v.message);
    expect(
      messages.some((m) => m.includes("Untranslated JSX text literal")),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("Untranslated JSX string expression")),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes('Literal UI attribute "placeholder"')),
    ).toBe(true);
    expect(messages.some((m) => m.includes('Literal UI attribute "alt"'))).toBe(
      true,
    );
    expect(
      messages.some((m) => m.includes('Literal UI attribute "aria-label"')),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes('Literal UI attribute "title"')),
    ).toBe(true);
  });

  it("enforces en-US and id-ID recursive key parity and non-empty translations when messages directory exists", () => {
    // cspell:ignore Simpan Hapus Lainnya
    createFixture({
      "messages/en-US.json": JSON.stringify({
        common: {
          save: "Save",
          cancel: "Cancel",
          extraOnlyInEn: "Extra",
        },
        actions: {
          delete: "Delete",
        },
      }),
      "messages/id-ID.json": JSON.stringify({
        common: {
          save: "Simpan",
          cancel: "   ", // whitespace only
        },
        actions: {
          delete: "Hapus",
          extraOnlyInId: "Lainnya",
        },
      }),
    });

    const violations = runGuardrails(tempDir);
    const law2Violations = violations.filter((v) => v.law === 2);
    expect(law2Violations.length).toBeGreaterThanOrEqual(3);

    const messages = law2Violations.map((v) => v.message);
    expect(
      messages.some((m) =>
        m.includes("Missing translation key in id-ID: common.extraOnlyInEn"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes("Missing translation key in en-US: actions.extraOnlyInId"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes(
          "Empty or whitespace-only translation value in id-ID: common.cancel",
        ),
      ),
    ).toBe(true);
  });

  it("flags process.env outside src/env.ts and next.config.ts and non-placeholder secrets in .env.example", () => {
    createFixture({
      "src/app/page.tsx": `
        export default function Page() {
          const db = process.env.DATABASE_URL;
          const secret = process.env["SECRET_KEY"];
          return <div />;
        }
      `,
      "src/env.ts": `
        export const env = {
          DATABASE_URL: process.env.DATABASE_URL,
        };
      `,
      "next.config.ts": `
        const config = { env: process.env.NODE_ENV };
        export default config;
      `,
      ".env.example":
        "DATABASE_URL=postgresql://postgres:realpassword123@db.supabase.co:5432/postgres\nBETTER_AUTH_SECRET=f3a8b2c4d9e01234567890abcdef\nSTORAGE_DRIVER=local\n",
    });

    const violations = runGuardrails(tempDir);
    const law3Violations = violations.filter((v) => v.law === 3);
    expect(law3Violations.length).toBeGreaterThanOrEqual(2);

    const messages = law3Violations.map((v) => v.message);
    expect(
      messages.some((m) =>
        m.includes(
          "process.env usage forbidden outside src/env.ts and next.config.ts",
        ),
      ),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes("Non-placeholder secret detected in .env.example"),
      ),
    ).toBe(true);
  });

  it("flags hardcoded role comparisons and missing server-only/permission guard in DAL files", () => {
    createFixture({
      "src/features/auth/check.ts": `
        export function canEdit(user: any) {
          if (user.role === "admin" || user.role !== "treasurer") return true;
          if (hasRole("secretary")) return true;
          return false;
        }
      `,
      "src/server/dal/members/get-member.ts": `
        export async function getMember(id: string) {
          return { id };
        }
      `,
      "src/server/dal/members/get-valid.ts": `
        import "server-only";
        import { requirePermission } from "@/server/auth";
        export async function getValid(id: string) {
          await requirePermission("members.read");
          return { id };
        }
      `,
    });

    const violations = runGuardrails(tempDir);
    const law4Violations = violations.filter((v) => v.law === 4);
    expect(law4Violations.length).toBeGreaterThanOrEqual(3);

    const messages = law4Violations.map((v) => v.message);
    expect(
      messages.some((m) =>
        m.includes("Hardcoded role comparison (.role === / !==)"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("Hardcoded role comparison hasRole()")),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("DAL file must import 'server-only'")),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes(
          "DAL file must enforce requirePermission() or publicQuery()",
        ),
      ),
    ).toBe(true);
  });

  it("enforces AGENTS.md no-frontmatter budget, SKILL.md required frontmatter, ADR sections, and markdown links with anchors while ignoring fenced code blocks", () => {
    const lines130 = Array.from(
      { length: 130 },
      (_, i) => `Line ${i + 1}`,
    ).join("\n");
    createFixture({
      "AGENTS.md": `---\nname: agents\n---\n${lines130}`,
      ".agents/skills/broken-skill/SKILL.md":
        "# Missing Frontmatter\nSome content",
      "docs/adr/001-missing-sections.md":
        "# ADR 001: Missing Sections\n\nOnly title here.",
      "docs/standards/documentation.md": `
# Documentation Standard
Valid relative link with anchor: [ADR 002](../adr/002-valid.md#decision)
Broken relative link outside code fence: [Broken Link](../nonexistent/file.md)

\`\`\`markdown
[Fenced code block broken link](./should-be-ignored.md)
\`\`\`
      `,
      "docs/adr/002-valid.md": `
# ADR 002: Valid Architecture Decision Record
## Status
Accepted
## Context
Valid context
## Decision
Valid decision
## Consequences
Valid consequences
      `,
    });

    const violations = runGuardrails(tempDir);
    const law5Violations = violations.filter((v) => v.law === 5);
    expect(law5Violations.length).toBeGreaterThanOrEqual(5);

    const messages = law5Violations.map((v) => v.message);
    expect(
      messages.some((m) =>
        m.includes("AGENTS.md must not contain YAML frontmatter"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("AGENTS.md exceeds 120 lines budget")),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes("SKILL.md missing required frontmatter (name, description)"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("ADR missing required section")),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes("Broken relative markdown link: ../nonexistent/file.md"),
      ),
    ).toBe(true);
    // Ensure fenced code link was ignored
    expect(messages.some((m) => m.includes("should-be-ignored.md"))).toBe(
      false,
    );
  });

  it("flags banned/conflicting packages in package.json, raw Server Actions bypassing safe-action, and unsanitized dangerouslySetInnerHTML", () => {
    createFixture({
      "package.json": JSON.stringify({
        name: "pemuda",
        dependencies: {
          "@radix-ui/react-button": "^1.0.0",
          "@supabase/supabase-js": "^2.0.0",
          moment: "^2.30.0",
          lodash: "^4.17.21",
        },
        devDependencies: {
          "tailwindcss-animate": "^1.0.7",
          nanoid: "^5.0.0",
        },
      }),
      "src/app/actions-bad.ts": `
        "use server";
        export async function badAction(formData: FormData) {
          return { ok: true };
        }
      `,
      "src/app/safe-action-good.ts": `
        "use server";
        import { actionClient } from "@/lib/safe-action";
        export const goodAction = actionClient.action(async () => {
          return { ok: true };
        });
      `,
      "src/app/content-bad.tsx": `
        export function BadContent({ html }: { html: string }) {
          return <div dangerouslySetInnerHTML={{ __html: html }} />;
        }
      `,
      "src/app/content-good.tsx": `
        import sanitizeHtml from "sanitize-html";
        export function GoodContent({ html }: { html: string }) {
          const clean = sanitizeHtml(html);
          return <div dangerouslySetInnerHTML={{ __html: clean }} />;
        }
      `,
    });

    const violations = runGuardrails(tempDir);
    const law6Violations = violations.filter((v) => v.law === 6);
    expect(law6Violations.length).toBeGreaterThanOrEqual(4);

    const messages = law6Violations.map((v) => v.message);
    expect(
      messages.some((m) =>
        m.includes("Banned package detected: @radix-ui/react-button"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes("Banned package detected: @supabase/supabase-js"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("Banned package detected: moment")),
    ).toBe(true);
    expect(
      messages.some((m) => m.includes("Banned package detected: lodash")),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes("Banned package detected: tailwindcss-animate"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes("Server action in 'use server' file must use safe-action"),
      ),
    ).toBe(true);
    expect(
      messages.some((m) =>
        m.includes("dangerouslySetInnerHTML used without sanitizeHtml"),
      ),
    ).toBe(true);
  });
});
