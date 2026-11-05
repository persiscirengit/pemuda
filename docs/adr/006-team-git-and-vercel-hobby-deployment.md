# ADR 006: Team Git Workflow and Vercel Hobby Deployment

## Status

Accepted

## Context

Deploying a multi-contributor application on the Vercel Hobby plan requires careful account architecture because Vercel Hobby accounts are intended for personal, non-commercial use by an individual owner. If multiple contributors push directly to repository branches, Vercel team collaborator limits and hobby terms can cause deployment failures.

At the same time, quality gates must apply equally to all human developers and AI agents to prevent broken code from landing on the production `main` branch.

## Decision

We establish a dedicated repository ownership and deployment model:

1. **Ownership Model:**
   - The production deployment is linked to a single dedicated Infrastructure Owner personal GitHub account connected to Vercel Hobby.
   - The three core contributors collaborate via personal GitHub accounts by submitting feature-branch Pull Requests (`feat/issue-<N>-<slug>`).

2. **Branch Protection & Ruleset on `main`:**
   - Direct pushes and force pushes to `main` are strictly blocked.
   - All changes must arrive via Pull Requests.
   - Merging to `main` requires the GitHub Actions `ci` status check (Verification and Build) to be green.
   - Merges are restricted to **Squash and Merge** only, ensuring clean linear history.

3. **Vercel Hobby Deployment Configuration:**
   - Automatic preview deployments for pull request branches can be disabled or managed to conserve Vercel build minutes.
   - Production deployments are triggered exclusively on successful squash merges to `main` (`vercel.json`: `{ "git": { "deploymentEnabled": { "main": true } } }`).

4. **Issue-Driven Development:**
   - Every pull request must link to an approved GitHub Issue.
   - Contributors work in isolated slices following `.agents/skills/implement-issue/SKILL.md`.

## Consequences

- 100% free-tier operation on Vercel Hobby with zero risk of account overage.
- Clean, auditable git commit history with atomic squashed commits corresponding to specific GitHub issues.
- Mechanical quality gates prevent any broken or unverified code from deploying to production.
