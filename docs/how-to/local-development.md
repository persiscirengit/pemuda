# Local Development Guide

This guide explains how to set up and run the Pemuda Next.js web application locally on your machine.

## Prerequisites

- **Node.js:** 22.x LTS installed
- **Corepack:** Enabled (`corepack enable`) to manage `pnpm`
- **Database:** Local PostgreSQL 16+ instance or Docker container

## Setup Steps

### 1. Install Dependencies

```bash
corepack pnpm install
```

### 2. Configure Environment Variables

Copy the template configuration file:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your local connection details:
```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pemuda_dev

# Better Auth
BETTER_AUTH_SECRET=development-secret-only-not-for-production
BETTER_AUTH_URL=http://localhost:3000

# File Storage (local driver stores uploads in public/uploads/)
STORAGE_DRIVER=local
NEXT_PUBLIC_STORAGE_BASE_URL=/uploads

# Admin Bootstrapping
BOOTSTRAP_ADMIN_EMAIL=admin@persiscirengit.org
BOOTSTRAP_ADMIN_PASSWORD=change-me-local-password
```

### 3. Initialize Database Schema

Apply Drizzle schema migrations to your local PostgreSQL instance:
```bash
corepack pnpm exec drizzle-kit push
```

### 4. Run Development Server

Start Next.js with Turbopack:
```bash
corepack pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running Verification Checks

Before creating a commit or opening a pull request, run the full verification suite:
```bash
corepack pnpm check
```
This runs:
1. `typecheck`: TypeScript compiler checks
2. `lint`: Biome code quality and import hygiene
3. `check:spell`: cspell US English verification
4. `check:guardrails`: 6-law AST architecture rules
5. `test`: Vitest automated tests
