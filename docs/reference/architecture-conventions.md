# Architecture Conventions

This reference document defines standard architectural patterns, directory structures, and library integration guidelines for the Pemuda Next.js platform.

## Directory Layout

```text
src/
├── app/                               # Next.js 16 App Router pages and layouts
│   ├── (auth)/                        # Authentication routes (login, profile)
│   ├── (dashboard)/                   # Unified permission app shell routes
│   ├── api/                           # Route handlers (cron triggers, webhooks)
│   ├── globals.css                    # Tailwind CSS v4 variables & emerald theme
│   └── layout.tsx                     # Root HTML layout
├── components/
│   ├── ui/                            # shadcn/ui radix-nova primitives (CLI-owned)
│   └── shared/                        # Reusable compound components (data tables, modals)
├── db/
│   ├── index.ts                       # Drizzle ORM client instance
│   └── schema/                        # Domain schemas (auth, organization, activities, etc.)
├── features/                          # Domain feature modules (slices)
│   ├── auth/                          # Authentication hooks, forms, actions
│   ├── activities/                    # Activity management, attendance check-in
│   ├── finance/                       # Ledger, transactions, dues generator
│   └── members/                       # Roster management, CSV import/export
├── lib/                               # Shared utilities (safe-action client, S3 helper)
├── server/
│   └── dal/                           # Data Access Layer (import "server-only")
│       ├── activities/
│       ├── finance/
│       └── members/
└── env.ts                             # T3 Env schema definition
messages/
├── en-US.json                         # Canonical translation keys (source of truth)
└── id-ID.json                         # Indonesian localized strings (default display)
```

## Data Access Layer (DAL) Contract

All database reads and writes must be encapsulated within `src/server/dal/**`:
1. Every DAL file must begin with `import "server-only";`.
2. Every export must execute an authorization check before accessing data:
   - Protected: `await requirePermission(PERMISSIONS.ACTIVITIES_ATTENDANCE_MANAGE);`
   - Public: `await publicQuery();`
3. Never import database clients directly in client components or route pages.

## Database & Schema Standards

- **Primary Keys:** UUIDv7 (`uuidv7()` generated via `uuid` package) stored in native PostgreSQL `uuid` columns.
- **Timestamps:** UTC `timestamptz` with timezone support (`timestamp("created_at", { withTimezone: true })`).
- **Currency:** Integer Rupiah (`integer("amount_idr")`), never floating-point numbers.
- **Storage References:** Relative storage object keys (e.g. `uploads/avatars/uuid.webp`), never full bucket URLs.

## UI Primitives & shadcn v4 radix-nova

- Initialized with `--base radix --preset radix-nova` (`"style": "radix-nova"` in `components.json`).
- Default desktop control height is `32px` (`h-8`).
- Mobile field actions and primary calls-to-action (e.g. GPS/QR check-in) use `size="lg"`.
- Always add primitives via `corepack pnpm dlx shadcn@latest add <component>`.
- Form architecture: Use `<Field>`, `<FieldGroup>`, `<FieldLabel>`, `<FieldDescription>`, `<FieldError>` with `Controller` and `react-hook-form` + `@hookform/resolvers/zod`.

## Table State & Search Params

- Data tables use `@tanstack/react-table@latest` (v9 tree-shakeable `tableFeatures()` API).
- Filter, pagination, and sorting state in URLs are managed via `nuqs`.

## Server Actions & Mutations

- Server Actions are declared in `src/features/**/actions.ts` using `next-safe-action`:

  ```typescript
  "use server";
  import { actionClient } from "@/lib/safe-action";
  import { z } from "zod";

  export const createActivityAction = actionClient
    .schema(createActivitySchema)
    .action(async ({ parsedInput }) => {
      // mutations through DAL
    });
  ```
- Direct raw `"use server"` functions are rejected by Law 6 guardrails.

## Permission Key Naming

Permissions follow the format `<domain>.<resource>.<action>`:
- `organization.departments.manage`
- `activities.events.create`
- `finance.transactions.read`
- `members.roster.export`
