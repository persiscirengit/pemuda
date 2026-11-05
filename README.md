# Pemuda Next.js Web Platform

Modern, vendor-agnostic web application platform for Pemuda Persis Cirengit, built with Next.js 16 (App Router), React 19, TypeScript 7, Tailwind CSS v4, and Drizzle ORM.

## Tech Stack & Architecture

- **Framework:** Next.js 16 (App Router, Turbopack)
- **Language:** TypeScript 7 (Strict, native CLI checker)
- **Styling & UI:** Tailwind CSS v4, shadcn/ui (`radix-nova` style, emerald theme)
- **Database & DAL:** PostgreSQL, Drizzle ORM, `server-only` Data Access Layer
- **Auth & Permissions:** Better Auth, 4-table dynamic RBAC, granular permission guards
- **Toolchain & Quality:** Biome (lint & format), cspell (en-US), Vitest, 6-law AST guardrails

## Getting Started

### Prerequisites

- Node.js 22.x LTS
- Corepack enabled (`pnpm` v12+)

### Setup

```bash
# Clone and install dependencies
corepack pnpm install

# Copy environment template
cp .env.example .env.local

# Run quality checks
corepack pnpm check

# Start development server
corepack pnpm dev
```

## Available Scripts

- `corepack pnpm dev`: Start Next.js local development server
- `corepack pnpm build`: Create optimized production build
- `corepack pnpm check`: Run complete verification suite (typecheck, lint, spellcheck, guardrails, tests)
- `corepack pnpm typecheck`: TypeScript compiler checks (`tsc --noEmit`)
- `corepack pnpm lint`: Biome code quality checks
- `corepack pnpm format`: Biome automatic formatter
- `corepack pnpm check:spell`: cspell en-US dictionary verifier
- `corepack pnpm check:guardrails`: 6-law mechanical AST and architecture guardrails
- `corepack pnpm test`: Vitest unit and integration test runner

## Documentation

Comprehensive project documentation is organized using the Diataxis framework inside the `docs/` directory. See [docs/README.md](docs/README.md) for guides, ADRs, and architecture references.
