# ADR 003: Permission-Based Role-Based Access Control

## Status

Accepted

## Context

Checking role names directly in UI components or business logic (e.g. `if (user.role === 'admin')` or `hasRole('treasurer')`) leads to brittle authorization architectures. When roles change, new administrative duties are assigned, or custom roles are introduced, hardcoded role checks require extensive code refactoring and inevitably introduce security vulnerabilities.

Furthermore, officers in Pemuda Persis are simultaneously active members. Bifurcating the application into separate "Admin" and "Member" portal codebases produces duplicate logic, broken navigation, and fragmented user profiles.

## Decision

We enforce a strict, permission-centric authorization architecture:

1. **Schema & RBAC Structure:**
   - Authorization is governed by four normalized database tables: `roles`, `permissions`, `role_permissions`, and `user_roles`.
   - Permissions are represented as structured constants following the convention `<domain>.<resource>.<action>` (e.g. `finance.transactions.manage`, `activities.attendance.verify`).

2. **Ban on Role Name Comparisons:**
   - Directly inspecting role names (such as `.role ===`, `.role !==`, or `hasRole()`) in application source code is strictly banned and rejected by Law 4 guardrails.
   - All authorization gates must evaluate granular permissions via `requirePermission(permissionKey)`.

3. **Data Access Layer (DAL) Contract:**
   - All server-side data fetching and mutations reside in `src/server/dal/**`.
   - Every DAL module must declare `import "server-only"`.
   - Every DAL function must either verify permissions with `await requirePermission(...)` or explicitly declare public accessibility with `publicQuery(...)`.

4. **Unified Application Shell:**
   - The application provides a single unified navigation shell (`shadcn` `<SidebarProvider />`).
   - Sidebar navigation items are declared in a centralized configuration array specifying icon, permission key, and i18n title. Items are dynamically rendered based on the active user's permissions, ensuring officers see both administrative workflows and member self-service portals seamlessly.

## Consequences

- Granular, audit-proof access control: Permissions can be re-assigned across roles in the database without code modifications.
- Complete isolation of server-only database operations from client-side bundles.
- A single, cohesive user experience for all organizational members and officers.
