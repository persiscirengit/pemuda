# Issue and Pull Request Workflow

This guide establishes the collaboration workflow for the 3 core contributors and the Infrastructure Owner account.

## Workflow Principles

1. **Issue-Driven Execution:** All work must correspond to an assigned GitHub Issue. Never introduce unrelated refactorings or out-of-scope features into an issue pull request.
2. **Schema-PR Isolation Rule:** When an issue requires database schema modifications (files in `src/db/schema/**`), the schema definitions and seeders must be submitted as a small, isolated Schema PR first. Once merged to `main`, feature UI, Server Actions, and DAL logic can proceed on a dependent branch.
3. **Linear History:** All pull requests are merged using **Squash and Merge** by the Infrastructure Owner.

## Development Lifecycle

### Step 1: Branch Creation

Create a branch named after the assigned issue:
```bash
git checkout main
git pull origin main
git checkout -b feat/issue-<N>-<short-slug>
```

### Step 2: Implement via Superpowers TDD

Follow `.agents/skills/implement-issue/SKILL.md`:
- Review issue acceptance criteria and relevant ADRs.
- Write failing tests first (`superpowers:test-driven-development`).
- Implement the minimal clean code to pass.
- Verify APIs using `context7` MCP.

### Step 3: Run Local Checks

Ensure all mechanical gates pass cleanly before pushing:
```bash
corepack pnpm check
corepack pnpm build
```

### Step 4: Commit and Push

Use conventional commit messages in US English (`en-US`):
```bash
git add .
git commit -m "feat(members): implement member roster list view"
git push -u origin feat/issue-<N>-<short-slug>
```

### Step 5: Open Pull Request

1. Open a PR targeting `main`.
2. Fill out all sections in the [Pull Request Template](../../.github/PULL_REQUEST_TEMPLATE.md).
3. Ensure the GitHub Actions `ci` check passes (Verification and Build).
4. Request review from the Infrastructure Owner.
