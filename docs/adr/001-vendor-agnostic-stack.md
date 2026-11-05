# ADR 001: Vendor-Agnostic Web Stack

## Status

Accepted

## Context

The previous architecture was a monolithic deployment requiring a paid virtual private server (VPS). The organization requires a modern, $0/month serverless architecture with full vendor portability, zero proprietary cloud lock-in, and high long-term maintainability.

Proprietary vendor platforms (such as Supabase SDKs, Firebase, or AWS Amplify) introduce vendor lock-in. Hand-rolling custom primitive utilities (like bespoke CSV parsers, Haversine trigonometry, form validators, or table state managers) increases technical debt and defect rates.

## Decision

We standardize strictly on an open, portable, vendor-agnostic ecosystem where all packages are installed at `@latest` (`corepack pnpm add <pkg>@latest`) and verified using Context7:

1. **Framework & Language:** Next.js 16 (App Router, Turbopack), React 19, TypeScript 7 (Strict mode, Go CLI `tsc`), Tailwind CSS v4.
2. **Database & ORM:** Standard PostgreSQL (`DATABASE_URL`), `drizzle-orm@latest`, `drizzle-kit@latest`, `postgres@latest` driver, UUIDv7 primary keys.
3. **Authentication & RBAC:** `better-auth@latest` (Drizzle adapter, email/password + username NPA plugin) paired with dynamic 4-table RBAC.
4. **Storage:** `@aws-sdk/client-s3@latest` + `@aws-sdk/s3-request-presigner@latest` with dual-mode driver support (`STORAGE_DRIVER=local` for local development, `s3` for S3-compatible cloud buckets like Supabase Storage or Cloudflare R2).
5. **Validation, Forms & Actions:** `zod@latest`, `@t3-oss/env-nextjs@latest`, `drizzle-zod@latest`, `next-safe-action@latest`, `react-hook-form@latest` + `@hookform/resolvers@latest`.
6. **UI, Tables & URL State:** `shadcn/ui` (Radix Nova preset), `@tanstack/react-table@latest` (v9 tree-shakeable `tableFeatures()`), `nuqs@latest`.
7. **Domain Packages:** `papaparse@latest` (CSV), `geolib@latest` (GPS distance), `qrcode.react@latest` + `@yudiel/react-qr-scanner@latest` (QR attendance), `@tiptap/react@latest` + `sanitize-html@latest` (rich text), `web-push@latest` (VAPID push).
8. **Testing & Quality:** Biome, cspell, Vitest, oxc-parser AST guardrails.

Banned packages include: `@supabase/supabase-js`, `@supabase/ssr`, `moment`, `dayjs`, `luxon`, `axios`, `lodash`, `underscore`, `nanoid`, and `uuidv4`.

## Consequences

- Full vendor portability: Database and object storage can be migrated between any PostgreSQL provider and S3-compatible object storage provider via environment variables alone.
- High developer velocity and code quality by using standard maintained libraries instead of buggy bespoke primitives.
- Up-to-date documentation and modern TypeScript 7 compatibility enforced across all modules.
