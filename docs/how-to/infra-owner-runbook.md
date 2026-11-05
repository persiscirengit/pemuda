# Infrastructure Owner Runbook

This runbook documents production operations, platform setup, and maintenance procedures for the dedicated Infrastructure Owner personal account.

## 1. One-Time GitHub Branch Protection Ruleset

To ensure every human contributor and AI agent is bound by identical quality gates, configure a repository Ruleset on the `main` branch:

1. Navigate to **GitHub Repository -> Settings -> Rules -> Rulesets**.
2. Click **New ruleset -> New branch ruleset**.
3. Name: `main-protection`, Enforcement status: **Active**.
4. Target branches: Include **Default branch (`main`)**.
5. Enable the following protection rules:
   - **Restrict deletions:** Enabled
   - **Block force pushes:** Enabled
   - **Require a pull request before merging:**
     - Required approvals: 1 (Infra Owner)
     - Dismiss stale pull request approvals when new commits are pushed: Enabled
     - Require conversation resolution before merging: Enabled
   - **Require status checks to pass:**
     - Require branches to be up to date before merging: Enabled
     - Status checks that are required: `ci` (Verification and Build)
   - **Allowed merge methods:** Select **Squash and Merge** only. Disable Rebase and standard Merge commits.

## 2. Vercel Hobby Setup

1. Link the repository to the Infrastructure Owner's personal Vercel account.
2. In Project Settings:
   - Framework Preset: **Next.js**
   - Node.js Version: **22.x**
   - Install Command: `corepack pnpm install`
   - Build Command: `corepack pnpm build`
3. Configure Production Environment Variables in Vercel:
   - `DATABASE_URL`: Production PostgreSQL connection string
   - `BETTER_AUTH_SECRET`: Cryptographically random 32-character string
   - `BETTER_AUTH_URL`: Canonical domain (e.g. `https://pemuda.persiscirengit.org`)
   - `STORAGE_DRIVER`: `s3`
   - `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`
   - `NEXT_PUBLIC_STORAGE_BASE_URL`: Public CDN URL for uploaded assets
   - `CRON_SECRET`: Secret token for webhook authorization
   - `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`

## 3. Storage Provider Migration (S3 to Cloudflare R2)

The application utilizes standard `@aws-sdk/client-s3` and relative database keys (`uploads/...`). Migrating from initial free cloud storage (e.g. Supabase S3 1GB) to Cloudflare R2 (10GB free tier) requires zero code changes:

1. Create a Cloudflare R2 bucket (e.g. `pemuda-assets`).
2. Copy existing assets between buckets using S3 CLI tools:

   ```bash
   aws s3 sync s3://source-bucket s3://pemuda-assets --endpoint-url <r2-endpoint>
   ```
3. Update environment variables in Vercel:
   - `S3_ENDPOINT`: `https://<account_id>.r2.cloudflarestorage.com`
   - `S3_REGION`: `auto`
   - `S3_BUCKET`: `pemuda-assets`
   - `S3_ACCESS_KEY_ID`: Cloudflare R2 token ID
   - `S3_SECRET_ACCESS_KEY`: Cloudflare R2 token secret
   - `NEXT_PUBLIC_STORAGE_BASE_URL`: `https://cdn.persiscirengit.org`
4. Redeploy in Vercel.

## 4. Scheduled Background Reminders (cron-job.org)

To trigger scheduled agenda reminders without running persistent servers:
1. Register a free account on `cron-job.org`.
2. Create a scheduled HTTP job:
   - Title: `Pemuda Agenda Reminders`
   - URL: `https://pemuda.persiscirengit.org/api/cron/reminders`
   - Method: `POST`
   - Schedule: Daily at 06:00 WIB (`23:00 UTC`)
   - Headers: `Authorization: Bearer <CRON_SECRET>`

## 5. Database Disaster Recovery

1. Automated daily logical backups should be scheduled via your PostgreSQL cloud provider.
2. Manual on-demand snapshot:

   ```bash
   pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%Y%m%d).dump
   ```
3. Restore verification:

   ```bash
   pg_restore -d "$DATABASE_URL" --clean --if-exists backup.dump
   ```
