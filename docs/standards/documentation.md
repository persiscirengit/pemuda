# Documentation Standard

This standard defines the mandatory rules for authoring, updating, and verifying documentation across the Pemuda Next.js platform.

## 1. Diataxis Classification

All project documentation must be organized into one of the four Diataxis quadrants:

1. **How-To Guides (`docs/how-to/`):** Practical step-by-step instructions addressing specific operational goals (e.g. setting up environments, onboarding contributors).
2. **Reference (`docs/reference/`):** Technical descriptions, data dictionaries, schema references, and architecture conventions.
3. **Standards & Explanation (`docs/standards/`):** Clarifications on design philosophy, development standards, and governance policies.
4. **Architecture Decision Records (`docs/adr/`):** Formal, numbered decision records recording key technical choices.

## 2. Architecture Decision Records (ADRs)

Every decision record must follow the naming pattern `docs/adr/00N-<slug>.md` and contain the four required sections:

- `## Status`: Must state whether the ADR is Proposed, Accepted, or Superseded.
- `## Context`: Explains the architectural problem, motivations, constraints, and alternatives considered.
- `## Decision`: Detailed technical decision, library selections, and design specifics.
- `## Consequences`: Downstream impacts, trade-offs, and compliance obligations.

For example, see [ADR 001 Decision](../adr/001-vendor-agnostic-stack.md#decision) for the approved ecosystem libraries.

## 3. Language and Spelling Mandate

- All documentation prose, comments, filenames, and diagrams must be written in **US English (`en-US`)**.
- Spelling is mechanically validated on every CI run via `corepack pnpm check:spell` (`cspell.json`).
- Organization domain terms must be cataloged in `cspell-org-terms.txt`.

## 4. Technical Accuracy and Verification

- Any external library API mentioned in documentation must be verified against current official documentation using the `context7` MCP tool (`resolve-library-id` followed by `query-docs`).
- Never document hypothetical, unreleased, or deprecated APIs.

## 5. Markdown Link Integrity

- All relative links between markdown files must resolve to existing files.
- Relative links with anchor fragments (such as `#decision`) must match an existing heading slug in the target document.
- Illustrative or non-resolving link examples must be placed inside fenced code blocks:

```markdown
[Illustrative broken link](./does-not-exist.md)
```

Fenced code blocks are excluded by the repository guardrail engine (`scripts/guardrails.ts` Law 5).
