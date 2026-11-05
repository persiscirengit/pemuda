<!-- BEGIN:nextjs-agent-rules -->
# Repository Agent Rules: Pemuda Next.js

Welcome, agentic collaborators. This repository is built strictly with Next.js 16 (App Router), React 19, TypeScript 7, and Tailwind CSS v4. Official Next.js 16 documentation is bundled locally in `node_modules/next/dist/docs/`.

## Mandatory Agent Workflow

1. **Superpowers Discipline:** All implementation and planning work must follow `superpowers` skills (`using-superpowers`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`).
2. **Context7 First:** For external library APIs, query `context7` MCP (`resolve-library-id` followed by `query-docs`). Read local source and official documentation before writing code.
3. **Ecosystem-First (@latest):** Never hand-roll custom utilities for validation, forms, tables, URL state, CSV, distance, QR, rich text, or push notifications. Install designated packages strictly via `@latest` (`corepack pnpm add <pkg>@latest`).
4. **Language Mandate:** 100% US English (`en-US`) across all code, identifiers, comments, commit messages, PRs, and documentation (enforced by `cspell`).

## The 6 Mechanical Laws

All code must satisfy `pnpm check` (`pnpm check:guardrails` via `scripts/guardrails.ts`):
- **Law 1 (UI Governance):** Use `shadcn/ui` v4 `radix-nova` components and semantic tokens. Raw HTML controls (`<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`), arbitrary colors (`hover:bg-[#10b981]`), legacy `<FormField>`, and `tailwind.config.*` are banned.
- **Law 2 (Strict i18n):** Zero hardcoded JSX text or literal UI attributes in `src/app/**` or `src/features/**`. All user-facing text uses `next-intl`. Key parity and non-empty translations are enforced between `messages/en-US.json` and `messages/id-ID.json`.
- **Law 3 (Secret Isolation):** `process.env` is restricted to `src/env.ts` and `next.config.ts`. No committed `.env*` files (except placeholder `.env.example`).
- **Law 4 (Permission-Only RBAC):** Role name checks (`.role === 'admin'`, `hasRole()`) are banned. Enforce granular permissions (`requirePermission()`). All DAL files in `src/server/dal/**` must import `"server-only"`.
- **Law 5 (Docs & Agent Integrity):** `AGENTS.md` has no frontmatter and <= 120 lines. `.agents/skills/*/SKILL.md` requires `name:` and `description:` frontmatter. ADRs require Status, Context, Decision, Consequences. Markdown relative links must resolve.
- **Law 6 (Anti-Primitive Discipline):** Banned/vendor-locked packages are rejected. Server Actions in `src/app/**` and `src/features/**` must use `next-safe-action`. `dangerouslySetInnerHTML` requires `sanitizeHtml`.

## Documentation Map

- [Documentation Map](docs/README.md): Index of Diataxis guides, ADRs, and runbooks.
- [Architecture Conventions](docs/reference/architecture-conventions.md): DAL contracts, schema conventions, and UI standards.
- [Agent Environment Setup](docs/how-to/agent-environment-setup.md): Environment setup for superpowers and context7 MCP.
<!-- END:nextjs-agent-rules -->
