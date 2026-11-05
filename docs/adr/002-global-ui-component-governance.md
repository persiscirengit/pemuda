# ADR 002: Global UI Component Governance

## Status

Accepted

## Context

A major failure mode in modern web projects is UI fragmentation: developers introducing raw HTML input/button tags, arbitrary hardcoded Tailwind color utilities (e.g. `bg-[#10b981]`), outdated animation packages, and inconsistent form architectures across different feature modules.

Furthermore, shadcn/ui recently released v4, introducing presets such as `radix-nova` and unifying accessibility and peer dependency management under CLI-owned installations.

## Decision

We establish strict repository-wide governance over all UI components and styling:

1. **Preset & Style:**
   - Standardize on `shadcn@latest` v4 initialized with `--base radix --preset radix-nova` (`"style": "radix-nova"` in `components.json`).
   - Default desktop and tablet controls use the compact `32px` (`h-8`) height and `6–8px` border radius.
   - Mobile-first field actions and primary calls-to-action (such as GPS/QR check-in) use `size="lg"` for comfortable touch targets.

2. **CLI-Owned Peer Installation:**
   - All primitive UI components must be added via `corepack pnpm dlx shadcn@latest add <component>`.
   - Direct manual installation of `@radix-ui/react-*` split packages or `@base-ui/*` is prohibited.
   - Legacy `tailwindcss-animate` and `tailwind.config.js` are banned; Tailwind CSS v4 CSS variables in `src/app/globals.css` are the single source of theme styling.

3. **Form Architecture:**
   - Forms must use the shadcn v4 `<Field>`, `<FieldGroup>`, `<FieldLabel>`, `<FieldDescription>`, and `<FieldError>` components paired with `react-hook-form` and `<Controller>`.
   - Legacy `<FormField>` and `@/components/ui/form` imports are banned.

4. **Data Tables & Feedback:**
   - Data tables standardize on `@tanstack/react-table@latest` (v9 tree-shakeable `tableFeatures()` API) and `nuqs` for search params.
   - Notifications and toast alerts use `sonner`.
   - Primary navigation shell uses `sidebar` (`<SidebarProvider />`).

5. **Guardrails Enforcement:**
   - Raw HTML controls (`<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`) and modifier-prefixed arbitrary color classes (`hover:bg-[#10b981]`, `dark:text-[rgb(15,23,42)]`) are rejected by mechanical guardrails (`scripts/guardrails.ts` Law 1).

## Consequences

- Guaranteed visual and behavioral consistency across all administrative, operational, and member portal screens.
- Seamless Tailwind CSS v4 compatibility with zero configuration overhead.
- Accessibility compliance and keyboard navigation provided by tested Radix primitives.
