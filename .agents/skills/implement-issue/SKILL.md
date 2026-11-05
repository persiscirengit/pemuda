---

name: implement-issue
description: Standard operating procedure for implementing an assigned GitHub Issue end-to-end using superpowers, context7, and TDD
---

# Implement Issue SOP

This skill defines the standard procedure for implementing an assigned GitHub Issue in the Pemuda Next.js platform.

## Workflow Steps

1. **Issue Assignment & Kickoff Comment (Mandatory Audit Trail):**
   - Assign the issue to yourself before starting work:

     ```bash
     gh issue edit <N> --add-assignee @me
     ```
   - Post a kickoff comment documenting the starting branch:

     ```bash
     gh issue comment <N> --body "Assigned to @$(gh api user -q .login). Starting implementation on branch \`feat/issue-<N>-<slug>\` following TDD and project standards."
     ```

2. **Branch Creation:**
   - Create a dedicated branch from latest `main`:

     ```bash
     git checkout main && git pull origin main
     git checkout -b feat/issue-<N>-<slug>
     ```

3. **Read Specifications:**
   - Read the assigned GitHub Issue description and acceptance criteria completely (`gh issue view <N>`).
   - Review relevant Architecture Decision Records in `docs/adr/` and standards in `docs/standards/`.

4. **Install Designated Packages (@latest):**
   - If the issue requires ecosystem dependencies, install them strictly via `@latest`:

     ```bash
     corepack pnpm add <package>@latest
     ```
   - Never hand-roll custom primitive utilities.

5. **Verify APIs with Context7 & Next.js Bundled Docs:**
   - Query `context7` MCP (`resolve-library-id`, then `query-docs`) for the exact modern APIs.
   - For Next.js 16 APIs, consult `node_modules/next/dist/docs/`.

6. **Execute TDD Cycle:**
   - Follow `superpowers:test-driven-development`.
   - Write failing unit/integration tests first.
   - Implement the minimal clean code to pass.
   - Ensure 100% US English (`en-US`) across all identifiers, comments, and strings.

7. **Run Full Verification:**
   - Run the mechanical verification suite:

     ```bash
     corepack pnpm check
     corepack pnpm build
     ```
   - Confirm exit code 0 and zero guardrail violations.

8. **Open Pull Request & Link Issue:**
   - Commit changes with conventional commit messages (`feat: ...` or `fix: ...`).
   - Push branch and open a Pull Request following `.github/PULL_REQUEST_TEMPLATE.md` with `Closes #<N>` in the body:

     ```bash
     git push -u origin feat/issue-<N>-<slug>
     gh pr create --title "feat(<scope>): ..." --body "Closes #<N> ..." --base main
     ```
   - Post a completion comment on the issue referencing the PR:

     ```bash
     gh issue comment <N> --body "Implementation complete. Opened PR #<PR_NUMBER> for review."
     ```
