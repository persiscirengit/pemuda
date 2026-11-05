---

name: write-project-docs
description: Standard operating procedure for authoring and updating Diataxis documentation, ADRs, and technical guides
---

# Write Project Docs SOP

This skill enforces the repository documentation standard located in `docs/standards/documentation.md`.

## Workflow Steps

1. **Classify Documentation Type (Diataxis):**
   - **How-To Guides (`docs/how-to/`):** Step-by-step problem-oriented instructions.
   - **Reference (`docs/reference/`):** Information-oriented architecture conventions, schemas, and domain terms.
   - **Standards / Explanation (`docs/standards/`):** Understanding-oriented documentation policies.
   - **Architecture Decision Records (`docs/adr/`):** Immutable design records following format `00N-<slug>.md`.

2. **Structure ADRs Required Sections:**
   - Every ADR must include four required sections:
     - `## Status` (Proposed, Accepted, Superceded)
     - `## Context` (Background, motivation, and alternatives considered)
     - `## Decision` (Chosen solution and architectural rationale)
     - `## Consequences` (Positive impacts, trade-offs, and downstream requirements)

3. **Verify Technical Truth via Context7:**
   - Any external library API mentioned in documentation must be verified using `context7` MCP (`resolve-library-id` followed by `query-docs`).

4. **Ensure Strict US English (en-US):**
   - All prose, filenames, diagrams, and comments must use US English (`en-US`).
   - Run `pnpm check:spell` to verify spelling against `cspell.json`.

5. **Validate Markdown Links:**
   - All relative links must point to existing files.
   - Relative anchors (e.g. `../adr/001-vendor-agnostic-stack.md#decision`) must match valid headings.
   - Fenced code blocks containing illustrative markdown are excluded from link checks.
   - Run `pnpm check:guardrails` to ensure Law 5 compliance.
