# ADR 005: Zero Hardcode and Secret Isolation

## Status

Accepted

## Context

Accidental leakage of credentials in repository commits and brittle environment variable handling are severe security and operational risks. Falling back to default secrets in production or spreading raw `process.env` references across dozens of components causes runtime crashes that are difficult to debug.

Additionally, hardcoding full cloud bucket URLs (e.g. `https://bucket.s3.region.amazonaws.com/image.jpg`) directly into database columns prevents seamless storage provider migration and leaks infrastructure details into database backups.

## Decision

We enforce strict secret isolation and environment configuration standards:

1. **Centralized Environment Validation:**
   - All runtime environment variables must be declared and validated using `@t3-oss/env-nextjs@latest` in `src/env.ts`.
   - Accessing `process.env` directly outside `src/env.ts` and `next.config.ts` is banned and rejected by Law 3 guardrails.

2. **Secret Isolation & Git Safety:**
   - `.gitignore` ignores all `.env*` files with the single exception of `.env.example`.
   - `.env.example` must contain placeholder or empty values only. Real credentials or secrets committed to `.env.example` fail Law 3 guardrails.
   - Development secrets are provided via `.env.local` (untracked).

3. **Relative Storage Object Keys:**
   - Database tables storing file references must store relative storage object keys only (e.g. `uploads/members/123-avatar.webp`), never absolute URLs.
   - URLs are generated dynamically at request time using `NEXT_PUBLIC_STORAGE_BASE_URL` or S3 presigned URL helpers.

4. **Zero Hardcoded Identity:**
   - Organization name, branding, and contact details must be loaded from `SystemSettings` or configuration constants, never hardcoded into components.

5. **No Real Data in the Repository:**
   - This repository is public. Seeders contain system data only (permissions, starter roles, default settings). Tests and fixtures use clearly fake sample data.
   - Real members, credentials, and organization details exist only in the database or untracked env files, never in code, seeds, fixtures, docs, commits, or PRs.

## Consequences

- Fail-fast environment validation at build and start time: missing configuration is surfaced immediately.
- Zero credential leakage risks in public or private repositories.
- Effortless storage driver migration: switching between local disk, Supabase S3, and Cloudflare R2 requires changing environment variables without modifying database rows.
