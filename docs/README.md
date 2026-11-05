# Documentation Map

This documentation suite is organized using the **Diataxis** documentation framework to separate technical content by purpose: Tutorials, How-To Guides, Reference, and Explanation.

## Structure

```text
docs/
├── README.md                          # Documentation index (this file)
├── standards/
│   └── documentation.md               # Repository documentation standard
├── adr/                               # Architecture Decision Records
│   ├── 001-vendor-agnostic-stack.md
│   ├── 002-global-ui-component-governance.md
│   ├── 003-permission-based-rbac.md
│   ├── 004-strict-en-us-and-i18n.md
│   ├── 005-zero-hardcode-and-secret-isolation.md
│   └── 006-team-git-and-vercel-hobby-deployment.md
├── reference/                         # Canonical references & conventions
└── how-to/                            # Operational runbooks & team guides
```

## Standards & Policies

- [Documentation Standard](standards/documentation.md): Mandatory rules for authoring documentation, Diataxis placement, and link integrity.

## Architecture Decision Records (ADRs)

- [ADR 001: Vendor-Agnostic Web Stack](adr/001-vendor-agnostic-stack.md): Locking the modern open ecosystem libraries at `@latest`.
- [ADR 002: Global UI Component Governance](adr/002-global-ui-component-governance.md): Standardizing `shadcn/ui` with `radix-nova` preset and mobile primary CTAs.
- [ADR 003: Permission-Based RBAC](adr/003-permission-based-rbac.md): Granular permission gates and single navigation shell.
- [ADR 004: Strict US English and Localization](adr/004-strict-en-us-and-i18n.md): US English standard (`en-US`) and `next-intl` runtime translation.
- [ADR 005: Zero Hardcode and Secret Isolation](adr/005-zero-hardcode-and-secret-isolation.md): T3 Env encapsulation and zero raw `process.env`.
- [ADR 006: Team Git Workflow and Vercel Hobby Deployment](adr/006-team-git-and-vercel-hobby-deployment.md): Infrastructure owner model, branch protection, and CI gates.
