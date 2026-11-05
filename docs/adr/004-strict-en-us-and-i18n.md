# ADR 004: Strict US English and Localization Architecture

## Status

Accepted

## Context

Codebases with mixed-language identifiers, non-English comments, or hardcoded UI strings create confusion for autonomous coding agents, complicate internationalization, and reduce code quality.

At the same time, the primary audience for the Pemuda Persis Cirengit application speaks Indonesian (`id-ID`). A robust localization strategy must decouple developer technical vocabulary (English) from user interface presentation (Indonesian with English fallback).

## Decision

We enforce a strict language mandate and centralized internationalization architecture:

1. **Repository-Wide Language Mandate:**
   - 100% of all source code, variable names, database schema identifiers, comments, git commit messages, pull requests, issue templates, and technical documentation must be written in **US English (`en-US`)**.
   - Spelling compliance is enforced on every CI build via `cspell` (`"language": "en-US"`).

2. **Localization Engine (`next-intl`):**
   - We standardize on `next-intl@latest`.
   - Canonical translation keys are maintained in `messages/en-US.json`.
   - Indonesian end-user strings are maintained in `messages/id-ID.json`.
   - Default user locale is `id-ID` stored via the `NEXT_LOCALE` cookie.
   - Clean, unprefixed routing is used (no `/id` or `/en` URL prefixes).

3. **Guardrail Enforcement (Law 2):**
   - Hardcoded JSX text literals and literal UI attributes (`placeholder`, `title`, `aria-label`, `alt`) in `src/app/**` and `src/features/**` are rejected.
   - Recursive key parity between `messages/en-US.json` and `messages/id-ID.json` is verified mechanically; missing keys or whitespace-only values fail CI.

## Consequences

- High agentic reasoning performance and clean git history across all tooling.
- Complete separation of presentation strings from application logic.
- Guaranteed translation parity: UI strings cannot be deployed with untranslated or missing keys.
