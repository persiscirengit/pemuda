# Adding a Feature Slice

This guide provides a step-by-step checklist for implementing an end-to-end vertical feature slice in the Pemuda Next.js platform.

## Implementation Checklist

### 1. Database Schema

- [ ] Define or extend tables in `src/db/schema/<domain>.ts`.
- [ ] Use UUIDv7 for primary keys (`uuidv7()`).
- [ ] Use `timestamptz` for timestamps and integer for currency (Rupiah).
- [ ] Generate Drizzle Zod schemas via `drizzle-zod`.
- [ ] Submit as a Schema PR first if modifying shared schemas.

### 2. Data Access Layer (DAL)

- [ ] Create query and mutation functions in `src/server/dal/<domain>/`.
- [ ] Include `import "server-only";` at the top of every DAL file.
- [ ] Guard every function with `await requirePermission(PERMISSIONS.DOMAIN_RESOURCE_ACTION);` or `await publicQuery();`.

### 3. Server Actions

- [ ] Declare mutations in `src/features/<domain>/actions.ts` using `next-safe-action`:

  ```typescript
  "use server";
  import { actionClient } from "@/lib/safe-action";
  ```
- [ ] Validate inputs with Zod schemas.

### 4. UI Components

- [ ] Add necessary shadcn v4 primitives:

  ```bash
  corepack pnpm dlx shadcn@latest add <component>
  ```
- [ ] Use shadcn form components (`<Field>`, `<FieldGroup>`, `<FieldLabel>`, `<FieldError>`) with `Controller` and `react-hook-form`.
- [ ] Avoid raw HTML controls (`<button>`, `<input>`, `<select>`, `<textarea>`, `<table>`).
- [ ] Avoid modifier-prefixed arbitrary color classes (`hover:bg-[#10b981]`).

### 5. Internationalization (i18n)

- [ ] Add translation strings to both `messages/en-US.json` and `messages/id-ID.json`.
- [ ] Maintain 100% recursive key parity between both files.
- [ ] Ensure all user-facing strings are accessed via `useTranslations` or `getTranslations`. Zero raw JSX text literals in `src/app/**` and `src/features/**`.

### 6. App Router Page

- [ ] Create route entry points in `src/app/(dashboard)/<feature>/page.tsx`.
- [ ] Fetch data through the Data Access Layer.
- [ ] Pass localized strings and handlers into feature components.

### 7. Automated Testing & Verification

- [ ] Write unit tests covering business logic and edge cases in `tests/`.
- [ ] Run the complete verification suite:

  ```bash
  corepack pnpm check
  corepack pnpm build
  ```
