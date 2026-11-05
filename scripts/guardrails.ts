import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";

export interface GuardrailViolation {
  law: number;
  file: string;
  message: string;
  line?: number;
}

const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  "out",
  "coverage",
  ".superpowers",
  ".vercel",
]);

type AstNode = Record<string, unknown>;

function walkDirectory(dir: string, onFile: (filePath: string) => void) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDirectory(fullPath, onFile);
    } else if (entry.isFile()) {
      onFile(fullPath);
    }
  }
}

function walkAst(node: unknown, visit: (node: AstNode) => void) {
  if (!node || typeof node !== "object") return;
  const obj = node as AstNode;
  visit(obj);
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (Array.isArray(val)) {
      for (const item of val) {
        if (item && typeof item === "object") walkAst(item, visit);
      }
    } else if (val && typeof val === "object") {
      walkAst(val, visit);
    }
  }
}

export function runGuardrails(repoRoot: string): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];

  // ----------------------------------------------------
  // Law 1: Global UI & radix-nova Governance
  // ----------------------------------------------------
  const tailwindConfigs = [
    "tailwind.config.js",
    "tailwind.config.ts",
    "tailwind.config.mjs",
    "tailwind.config.cjs",
  ];
  for (const cfg of tailwindConfigs) {
    if (fs.existsSync(path.join(repoRoot, cfg))) {
      violations.push({
        law: 1,
        file: cfg,
        message:
          "tailwind.config.* is banned. Tailwind CSS v4 uses CSS theme tokens in globals.css.",
      });
    }
  }

  const componentsJsonPath = path.join(repoRoot, "components.json");
  if (fs.existsSync(componentsJsonPath)) {
    try {
      const componentsJson = JSON.parse(
        fs.readFileSync(componentsJsonPath, "utf-8"),
      );
      if (componentsJson.style !== "radix-nova") {
        violations.push({
          law: 1,
          file: "components.json",
          message: 'components.json must use style "radix-nova".',
        });
      }
    } catch {
      // JSON syntax errors handled elsewhere
    }
  }

  // ----------------------------------------------------
  // Law 6 (Part A): Banned packages in package.json
  // ----------------------------------------------------
  const packageJsonPath = path.join(repoRoot, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
      const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
      const bannedExact = new Set([
        "tailwindcss-animate",
        "@supabase/supabase-js",
        "@supabase/ssr",
        "moment",
        "dayjs",
        "luxon",
        "axios",
        "lodash",
        "underscore",
        "nanoid",
        "uuidv4",
      ]);

      for (const dep of Object.keys(allDeps)) {
        if (
          bannedExact.has(dep) ||
          dep.startsWith("@radix-ui/") ||
          dep.startsWith("@base-ui/")
        ) {
          violations.push({
            law: 6,
            file: "package.json",
            message: `Banned package detected: ${dep} in package.json.`,
          });
        }
      }
    } catch {
      // ignore
    }
  }

  // ----------------------------------------------------
  // Law 2 (Part B): Messages Parity
  // ----------------------------------------------------
  const messagesDir = path.join(repoRoot, "messages");
  if (fs.existsSync(messagesDir)) {
    const enPath = path.join(messagesDir, "en-US.json");
    const idPath = path.join(messagesDir, "id-ID.json");

    if (!fs.existsSync(enPath)) {
      violations.push({
        law: 2,
        file: "messages/en-US.json",
        message: "messages/en-US.json is missing.",
      });
    }
    if (!fs.existsSync(idPath)) {
      violations.push({
        law: 2,
        file: "messages/id-ID.json",
        message: "messages/id-ID.json is missing.",
      });
    }

    if (fs.existsSync(enPath) && fs.existsSync(idPath)) {
      try {
        const enJson = JSON.parse(fs.readFileSync(enPath, "utf-8"));
        const idJson = JSON.parse(fs.readFileSync(idPath, "utf-8"));

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

        const enKeys = collectKeys(enJson);
        const idKeys = collectKeys(idJson);

        for (const [k, v] of enKeys) {
          if (!idKeys.has(k)) {
            violations.push({
              law: 2,
              file: "messages/id-ID.json",
              message: `Missing translation key in id-ID: ${k}`,
            });
          }
          if (v.trim().length === 0) {
            violations.push({
              law: 2,
              file: "messages/en-US.json",
              message: `Empty or whitespace-only translation value in en-US: ${k}`,
            });
          }
        }

        for (const [k, v] of idKeys) {
          if (!enKeys.has(k)) {
            violations.push({
              law: 2,
              file: "messages/en-US.json",
              message: `Missing translation key in en-US: ${k}`,
            });
          }
          if (v.trim().length === 0) {
            violations.push({
              law: 2,
              file: "messages/id-ID.json",
              message: `Empty or whitespace-only translation value in id-ID: ${k}`,
            });
          }
        }
      } catch {
        // syntax error in JSON
      }
    }
  }

  // ----------------------------------------------------
  // Law 3: Secret & Env Isolation
  // ----------------------------------------------------
  const envExamplePath = path.join(repoRoot, ".env.example");
  if (fs.existsSync(envExamplePath)) {
    const envLines = fs.readFileSync(envExamplePath, "utf-8").split("\n");
    for (const line of envLines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim();
        if (value.length > 0) {
          const sensitiveKey = /SECRET|PASSWORD|PRIVATE_KEY|DATABASE_URL/i.test(
            key,
          );
          const isGenericPlaceholder =
            value === "local" ||
            value === "http://localhost:3000" ||
            value.startsWith("placeholder") ||
            value.startsWith("your-");
          if (sensitiveKey && !isGenericPlaceholder) {
            violations.push({
              law: 3,
              file: ".env.example",
              message: `Non-placeholder secret detected in .env.example: ${key}`,
            });
          }
        }
      }
    }
  }

  // ----------------------------------------------------
  // Law 5: Docs & Agent Integrity
  // ----------------------------------------------------
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  if (fs.existsSync(agentsPath)) {
    const agentsContent = fs.readFileSync(agentsPath, "utf-8");
    if (agentsContent.startsWith("---")) {
      violations.push({
        law: 5,
        file: "AGENTS.md",
        message: "AGENTS.md must not contain YAML frontmatter.",
      });
    }
    const lines = agentsContent.split("\n").length;
    if (lines > 120) {
      violations.push({
        law: 5,
        file: "AGENTS.md",
        message: `AGENTS.md exceeds 120 lines budget (got ${lines}).`,
      });
    }
    const byteLength = Buffer.byteLength(agentsContent, "utf-8");
    if (byteLength >= 24000) {
      violations.push({
        law: 5,
        file: "AGENTS.md",
        message: `AGENTS.md exceeds 24,000 bytes budget (got ${byteLength}).`,
      });
    }
  }

  // Skills frontmatter
  const skillsDir = path.join(repoRoot, ".agents", "skills");
  if (fs.existsSync(skillsDir)) {
    walkDirectory(skillsDir, (filePath) => {
      if (path.basename(filePath) === "SKILL.md") {
        const rel = path.relative(repoRoot, filePath);
        const content = fs.readFileSync(filePath, "utf-8");
        const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
        if (!fmMatch) {
          violations.push({
            law: 5,
            file: rel,
            message: `SKILL.md missing required frontmatter (name, description) in ${rel}.`,
          });
        } else {
          const fm = fmMatch[1] || "";
          if (!/name:\s*.+/i.test(fm) || !/description:\s*.+/i.test(fm)) {
            violations.push({
              law: 5,
              file: rel,
              message: `SKILL.md missing required frontmatter (name, description) in ${rel}.`,
            });
          }
        }
      }
    });
  }

  // ADR structure & Docs Markdown link checking
  const docsDir = path.join(repoRoot, "docs");
  if (fs.existsSync(docsDir)) {
    walkDirectory(docsDir, (filePath) => {
      if (!filePath.endsWith(".md")) return;
      const rel = path.relative(repoRoot, filePath);
      const content = fs.readFileSync(filePath, "utf-8");

      // Check ADR sections
      if (
        rel.startsWith(path.join("docs", "adr")) &&
        path.basename(rel) !== "README.md"
      ) {
        const requiredSections = [
          "Status",
          "Context",
          "Decision",
          "Consequences",
        ];
        for (const sec of requiredSections) {
          const headingRegex = new RegExp(`^##?\\s+${sec}\\b`, "im");
          if (!headingRegex.test(content)) {
            violations.push({
              law: 5,
              file: rel,
              message: `ADR missing required section "${sec}" in ${rel}.`,
            });
          }
        }
      }

      // Check Markdown relative links (ignore fenced code blocks)
      const contentWithoutFences = content.replace(/```[\s\S]*?```/g, "");
      const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
      for (const match of contentWithoutFences.matchAll(linkRegex)) {
        const target = (match[2] || "").trim();
        if (
          target.startsWith("http://") ||
          target.startsWith("https://") ||
          target.startsWith("mailto:") ||
          target.startsWith("#")
        ) {
          continue;
        }

        const [linkPath, anchor] = target.split("#");
        if (!linkPath) continue;

        const resolved = path.resolve(path.dirname(filePath), linkPath);
        if (!fs.existsSync(resolved)) {
          violations.push({
            law: 5,
            file: rel,
            message: `Broken relative markdown link: ${target} in ${rel}.`,
          });
        } else if (anchor && resolved.endsWith(".md")) {
          const targetContent = fs.readFileSync(resolved, "utf-8");
          const targetHeadings = targetContent
            .split("\n")
            .filter((l) => /^#+\s+/.test(l))
            .map((l) =>
              l
                .replace(/^#+\s+/, "")
                .trim()
                .toLowerCase()
                .replace(/[^\w\s-]/g, "")
                .replace(/\s+/g, "-"),
            );
          const normalizedAnchor = anchor.toLowerCase();
          if (!targetHeadings.includes(normalizedAnchor)) {
            violations.push({
              law: 5,
              file: rel,
              message: `Broken relative markdown link anchor #${anchor} in ${rel} -> ${linkPath}`,
            });
          }
        }
      }
    });
  }

  // ----------------------------------------------------
  // Source Tree Checks (Laws 1, 2, 3, 4, 6)
  // ----------------------------------------------------
  const rawControls = new Set([
    "button",
    "input",
    "select",
    "textarea",
    "table",
  ]);
  const arbitraryColorRegex =
    /(?:^|\s)(?:[\w-]+:)*(?:bg|text|border|fill|stroke|ring|accent|outline|from|to|via)-\[(?:#[0-9a-fA-F]+|(?:rgb|rgba|hsl|hsla)\([^\]]+\))\]/;

  walkDirectory(repoRoot, (filePath) => {
    const rel = path.relative(repoRoot, filePath);
    const isAppOrFeature =
      rel.startsWith(path.join("src", "app")) ||
      rel.startsWith(path.join("src", "features"));
    const isSrc = rel.startsWith("src");

    // Check forbidden staged .env files
    if (
      path.basename(filePath).startsWith(".env") &&
      path.basename(filePath) !== ".env.example"
    ) {
      violations.push({
        law: 3,
        file: rel,
        message: `Committed .env file forbidden: ${rel}.`,
      });
      return;
    }

    if (!filePath.endsWith(".ts") && !filePath.endsWith(".tsx")) {
      return;
    }

    const content = fs.readFileSync(filePath, "utf-8");

    // Law 3: process.env check outside src/env.ts and next.config.ts
    const isAllowedEnv =
      rel === path.join("src", "env.ts") ||
      rel === "next.config.ts" ||
      rel.startsWith(path.join("tests")) ||
      rel.startsWith(path.join("scripts"));

    if (!isAllowedEnv && /\bprocess\.env\b/.test(content)) {
      violations.push({
        law: 3,
        file: rel,
        message: `process.env usage forbidden outside src/env.ts and next.config.ts in ${rel}.`,
      });
    }

    // Law 4 (Part A): Hardcoded role comparisons in application source
    if (isSrc) {
      if (/\b\.role\s*[!=]==?/.test(content)) {
        violations.push({
          law: 4,
          file: rel,
          message: `Hardcoded role comparison (.role === / !==) in ${rel}.`,
        });
      }
      if (/\bhasRole\s*\(/.test(content)) {
        violations.push({
          law: 4,
          file: rel,
          message: `Hardcoded role comparison hasRole() in ${rel}.`,
        });
      }
    }

    // Law 4 (Part B): DAL enforcement
    if (rel.startsWith(path.join("src", "server", "dal"))) {
      if (!/import\s+['"]server-only['"]/.test(content)) {
        violations.push({
          law: 4,
          file: rel,
          message: `DAL file must import 'server-only' in ${rel}.`,
        });
      }
      if (!/\b(requirePermission|publicQuery)\s*\(/.test(content)) {
        violations.push({
          law: 4,
          file: rel,
          message: `DAL file must enforce requirePermission() or publicQuery() in ${rel}.`,
        });
      }
    }

    // Law 6 (Part C): dangerouslySetInnerHTML check
    if (content.includes("dangerouslySetInnerHTML")) {
      if (!/\bsanitizeHtml\b|\bsanitize\b/.test(content)) {
        violations.push({
          law: 6,
          file: rel,
          message: `dangerouslySetInnerHTML used without sanitizeHtml in ${rel}.`,
        });
      }
    }

    // Law 6 (Part B): Raw Server Actions
    if (isAppOrFeature && /^\s*["']use server["']/m.test(content)) {
      const usesSafeAction =
        content.includes("actionClient") ||
        content.includes("safeAction") ||
        content.includes("next-safe-action") ||
        content.includes("@/lib/safe-action");
      if (!usesSafeAction) {
        violations.push({
          law: 6,
          file: rel,
          message: `Server action in 'use server' file must use safe-action in ${rel}.`,
        });
      }
    }

    // AST Parse for JSX/UI Checks
    try {
      const parsed = parseSync(filePath, content);
      if (!parsed?.program) return;

      walkAst(parsed.program, (node) => {
        // Law 1: Legacy FormField / ui/form import check
        if (node.type === "ImportDeclaration" && node.source) {
          const sourceNode = node.source as AstNode;
          const importSource = String(sourceNode.value || "");
          if (
            importSource === "@/components/ui/form" ||
            importSource.endsWith("/components/ui/form")
          ) {
            violations.push({
              law: 1,
              file: rel,
              message: `Legacy FormField / ui/form import in ${rel}. Use shadcn Field + Controller.`,
            });
          }
          if (Array.isArray(node.specifiers)) {
            for (const item of node.specifiers) {
              const spec = item as AstNode;
              const imp = spec.imported as AstNode | undefined;
              const loc = spec.local as AstNode | undefined;
              if (imp?.name === "FormField" || loc?.name === "FormField") {
                violations.push({
                  law: 1,
                  file: rel,
                  message: `Legacy FormField / ui/form import in ${rel}. Use shadcn Field + Controller.`,
                });
              }
            }
          }
        }

        // Law 1 & Law 2 in src/app/** and src/features/**
        if (isAppOrFeature) {
          if (node.type === "JSXElement") {
            const opening = node.openingElement as AstNode | undefined;
            const nameNode = opening?.name as AstNode | undefined;
            const elementName =
              typeof nameNode?.name === "string" ? nameNode.name : "";

            // Law 1: Raw HTML controls
            if (elementName && rawControls.has(elementName)) {
              violations.push({
                law: 1,
                file: rel,
                message: `Raw HTML control <${elementName}> forbidden in ${rel}. Use shadcn components.`,
              });
            }

            // Law 2: Literal UI attributes & Law 1: modifier-prefixed colors in className
            const attrs = Array.isArray(opening?.attributes)
              ? opening.attributes
              : [];
            for (const item of attrs) {
              const attr = item as AstNode;
              if (attr.type === "JSXAttribute" && attr.name) {
                const attrNameNode = attr.name as AstNode;
                const attrName =
                  typeof attrNameNode.name === "string"
                    ? attrNameNode.name
                    : "";
                const valNode = attr.value as AstNode | undefined;

                // Law 1: Modifier-prefixed arbitrary color in className
                if (attrName === "className") {
                  let classVal = "";
                  if (
                    valNode?.type === "Literal" &&
                    typeof valNode.value === "string"
                  ) {
                    classVal = valNode.value;
                  }
                  if (classVal && arbitraryColorRegex.test(classVal)) {
                    violations.push({
                      law: 1,
                      file: rel,
                      message: `modifier-prefixed arbitrary color class forbidden in ${rel}. Use theme tokens.`,
                    });
                  }
                }

                // Law 2: Literal UI attributes
                if (
                  ["placeholder", "title", "aria-label", "alt"].includes(
                    attrName,
                  )
                ) {
                  if (
                    valNode?.type === "Literal" &&
                    typeof valNode.value === "string"
                  ) {
                    violations.push({
                      law: 2,
                      file: rel,
                      message: `Literal UI attribute "${attrName}" with untranslated string in ${rel}. Use next-intl.`,
                    });
                  } else if (valNode?.type === "JSXExpressionContainer") {
                    const expr = valNode.expression as AstNode | undefined;
                    if (
                      expr?.type === "Literal" ||
                      expr?.type === "TemplateLiteral"
                    ) {
                      violations.push({
                        law: 2,
                        file: rel,
                        message: `Literal UI attribute "${attrName}" with untranslated string expression in ${rel}. Use next-intl.`,
                      });
                    }
                  }
                }
              }
            }

            // Law 2: JSX text & JSX string expressions inside children
            const children = Array.isArray(node.children) ? node.children : [];
            for (const childItem of children) {
              const child = childItem as AstNode;
              if (child.type === "JSXText") {
                const text =
                  typeof child.value === "string" ? child.value.trim() : "";
                if (text && text.length > 0) {
                  violations.push({
                    law: 2,
                    file: rel,
                    message: `Untranslated JSX text literal "${text}" in ${rel}. Use next-intl.`,
                  });
                }
              } else if (child.type === "JSXExpressionContainer") {
                const expr = child.expression as AstNode | undefined;
                if (
                  expr?.type === "Literal" &&
                  typeof expr.value === "string"
                ) {
                  const val = expr.value.trim();
                  if (val.length > 0) {
                    violations.push({
                      law: 2,
                      file: rel,
                      message: `Untranslated JSX string expression "${val}" in ${rel}. Use next-intl.`,
                    });
                  }
                } else if (expr?.type === "TemplateLiteral") {
                  violations.push({
                    law: 2,
                    file: rel,
                    message: `Untranslated JSX string expression in ${rel}. Use next-intl.`,
                  });
                }
              }
            }
          }
        }
      });
    } catch {
      // parse errors
    }
  });

  return violations;
}

// CLI entry point
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(import.meta.filename)
) {
  const root = process.cwd();
  const violations = runGuardrails(root);
  if (violations.length > 0) {
    console.error(
      `\x1b[31m[Guardrails] Failed with ${violations.length} violation(s):\x1b[0m`,
    );
    for (const v of violations) {
      console.error(`  - Law ${v.law} [${v.file}]: ${v.message}`);
    }
    process.exit(1);
  } else {
    console.log(
      "\x1b[32m[Guardrails] All 6 laws passed with 0 violations.\x1b[0m",
    );
    process.exit(0);
  }
}
