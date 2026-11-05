---

name: implement-issue
description: Standard operating procedure for implementing an assigned GitHub Issue end-to-end using superpowers, context7, and TDD
---

# Implement Issue SOP

This skill defines the standard procedure for implementing an assigned GitHub Issue in the Pemuda Next.js platform.

## Workflow Steps

1. **Branch Creation:**
   - Create a dedicated branch from `main`:

     ```bash
     git checkout main && git pull
     git checkout -b feat/issue-<N>-<slug>
     ```

2. **Read Specifications:**
   - Read the assigned GitHub Issue description and acceptance criteria completely.
   - Review relevant Architecture Decision Records in `docs/adr/` and standards in `docs/standards/`.

3. **Install Designated Packages (@latest):**
   - If the issue requires ecosystem dependencies, install them strictly via `@latest`:

     ```bash
     corepack pnpm add <package>@latest
     ```
   - Never hand-roll custom primitive utilities.

4. **Verify APIs with Context7 & Next.js Bundled Docs:**
   - Query `context7` MCP (`resolve-library-id`, then `query-docs`) for the exact modern APIs.
   - For Next.js 16 APIs, consult `node_modules/next/dist/docs/`.

5. **Execute TDD Cycle:**
   - Follow `superpowers:test-driven-development`.
   - Write failing unit/integration tests first.
   - Implement the minimal clean code to pass.
   - Ensure 100% US English (`en-US`) across all identifiers, comments, and strings.

6. **Run Full Verification:**
   - Run the mechanical verification suite:

     ```bash
     corepack pnpm check
     corepack pnpm build
     ```
   - Confirm exit code 0 and zero guardrail violations.

7. **Open Pull Request:**
   - Commit changes with conventional commit messages (`feat: ...` or `fix: ...`).
   - Push branch and open a Pull Request following `.github/PULL_REQUEST_TEMPLATE.md`.
