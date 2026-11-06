# Activities Lifecycle, Monthly Recurring Generator & Attendance Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement activity lifecycle management, monthly recurring calendar generator, and attendance participant synchronization for GitHub Issue #24.

**Architecture:** Layered architecture adhering to the project's 6 Laws and ADRs: data access layer (DAL) files (`events.ts`, `generator.ts`) in `src/server/dal/activities/` guarded with `"server-only"` and RBAC permissions; type-safe server actions using `createPermissionActionClient`; frontend presentation with TanStack data tables, status transition dialogs, and occurrence preview generation wizards; and unit test suites verifying all DAL logic and edge cases via Vitest.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM, PostgreSQL, next-safe-action, next-intl, Tailwind CSS v4, Lucide React, Vitest.

**Spec:** GitHub Issue #24 (`feat(activities): implement activity lifecycle management, monthly recurring generator, and attendance participant synchronization`).

## Global Constraints

- Every DAL file MUST begin with `import "server-only";` and call `requirePermission()` (Law 4).
- Strict RBAC: All operations must check permissions (`PERMISSIONS.ACTIVITIES_EVENTS_*`, `PERMISSIONS.ACTIVITIES_SCHEDULES_GENERATE`) (Law 4).
- 100% US English in all code identifiers, comments, logs, and strings (Law 2).
- Zero raw HTML form/button controls; use Shadcn / Radix-Nova primitives (Law 1).
- 100% dictionary parity between `messages/en-US.json` and `messages/id-ID.json` (Law 2).
- Safe actions: all Server Actions must use `createPermissionActionClient` or `actionClient` (Law 6).
- TDD Iron Law: Write failing unit test first, verify failure, then implement minimal passing code.

## Review Focus

1. **Reason Logging for Lifecycle Transitions**: Changing activity status to `holiday`, `postponed`, `relocated`, or `cancelled` must reject empty or whitespace `changeReason`. Changing to `completed` or `scheduled` does not require `changeReason`.
2. **Attendance Disablement on Cancel/Holiday/Postpone**: Changing activity status to `cancelled`, `holiday`, or `postponed` must automatically set `attendanceEnabled = false` to prevent invalid check-ins.
3. **Monthly Generator Week Calculations**: Handles months with 4 or 5 occurrences of a specific day of week without out-of-range dates or month overflow.
4. **Duplicate Prevention in Generator**: Generator must cleanly skip dates where an activity already exists for that schedule, incrementing `skippedDuplicate` without crashing or inserting duplicates.
5. **Active Members Sync Only**: Participant sync must only create attendance records for members with `memberStatus === 'active'`. Members with status `'inactive'`, `'alumni'`, or `'moved'` must be excluded.

---

### Task 1: Activity Events DAL (`src/server/dal/activities/events.ts`) & Unit Tests (`tests/unit/activities-crud.test.ts`)

**Files:**
- Create: `src/server/dal/activities/events.ts`
- Create: `tests/unit/activities-crud.test.ts`

**Interfaces:**
- Consumes:
  - `PERMISSIONS` from `@/lib/permissions`
  - `requirePermission`, `UserSession`, `UnauthorizedError` from `@/server/dal/auth`
  - `activities`, `activityStatusEnum`, `attendanceRecords` from `@/db/schema/activities`
  - `departments`, `members` from `@/db/schema/organization`
- Produces:
  - `getActivities(params?: GetActivitiesParams, sessionOverride?: UserSession): Promise<ActivityWithDetails[]>`
  - `getActivityById(id: string, sessionOverride?: UserSession): Promise<ActivityWithDetails | null>`
  - `createActivity(input: CreateActivityInput, sessionOverride?: UserSession): Promise<Activity>`
  - `updateActivity(id: string, input: UpdateActivityInput, sessionOverride?: UserSession): Promise<Activity>`
  - `updateActivityStatus(id: string, input: UpdateActivityStatusInput, sessionOverride?: UserSession): Promise<Activity>`
  - `deleteActivity(id: string, sessionOverride?: UserSession): Promise<void>`
  - `generateAttendanceToken(): string` (generates 64-char URL-safe string)

- [ ] **Step 1: Write failing test in `tests/unit/activities-crud.test.ts`**
  Write tests covering:
  - `"server-only"` import enforcement
  - Permission checks (`ACTIVITIES_EVENTS_READ`, `CREATE`, `UPDATE`, `STATUS`, `DELETE`)
  - 6-state lifecycle validations
  - Mandatory `changeReason` for `holiday`, `postponed`, `relocated`, `cancelled`
  - Automatic `attendanceEnabled: false` when status becomes `holiday`, `postponed`, `cancelled`
  - Unique 64-character URL-safe attendance token generation
  - Activity creation, querying with filters, update, and deletion

- [ ] **Step 2: Run test to verify it fails**
  Run: `corepack pnpm vitest run tests/unit/activities-crud.test.ts`
  Expected: FAIL with "Cannot find module '@/server/dal/activities/events'"

- [ ] **Step 3: Implement `src/server/dal/activities/events.ts`**
  Implement:
  - `import "server-only";`
  - Type definitions: `ActivityStatus`, `GetActivitiesParams`, `CreateActivityInput`, `UpdateActivityInput`, `UpdateActivityStatusInput`, `ActivityWithDetails`
  - `generateAttendanceToken()`: returns 64-character crypto random string using `crypto.randomBytes(48).toString("base64url")`
  - `getActivities()`, `getActivityById()`, `createActivity()`, `updateActivity()`, `updateActivityStatus()`, `deleteActivity()`

- [ ] **Step 4: Run test to verify it passes**
  Run: `corepack pnpm vitest run tests/unit/activities-crud.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit Task 1**

  ```bash
  git add tests/unit/activities-crud.test.ts src/server/dal/activities/events.ts
  git commit -m "feat(activities): implement activity lifecycle management and events DAL with unit tests"
  ```

---

### Task 2: Monthly Recurring Generator DAL (`src/server/dal/activities/generator.ts`) & Unit Tests (`tests/unit/monthly-generator.test.ts`)

**Files:**
- Create: `src/server/dal/activities/generator.ts`
- Create: `tests/unit/monthly-generator.test.ts`

**Interfaces:**
- Consumes:
  - `PERMISSIONS` from `@/lib/permissions`
  - `requirePermission`, `UserSession`, `UnauthorizedError` from `@/server/dal/auth`
  - `agendaSchedules`, `agendaWeeklyTopics`, `activities`, `attendanceRecords` from `@/db/schema/activities`
  - `members` from `@/db/schema/organization`
  - `generateAttendanceToken` from `./events`
- Produces:
  - `calculateMonthlyOccurrences(scheduleId: string, year: number, month: number, sessionOverride?: UserSession): Promise<CalculatedOccurrence[]>`
  - `generateMonthlyActivities(scheduleId: string, input: GenerateMonthlyActivitiesInput, sessionOverride?: UserSession): Promise<MonthlyGenerationResult>`

- [ ] **Step 1: Write failing test in `tests/unit/monthly-generator.test.ts`**
  Write tests covering:
  - `"server-only"` import enforcement
  - Permission gate: `PERMISSIONS.ACTIVITIES_SCHEDULES_GENERATE`
  - Correct date generation for weeks 1–5 matching schedule's `dayOfWeek`
  - Topic synchronization from `agenda_weekly_topics`
  - Skipping inactive occurrences
  - Cleanly skipping existing duplicate dates without error
  - Attendance time window calculation (`attendanceOpenAt`, `attendanceCloseAt`)
  - 64-char URL-safe `attendanceToken` generation
  - Returning summary `{ created, skippedDuplicate, skippedInactive, participantsSynced }`

- [ ] **Step 2: Run test to verify it fails**
  Run: `corepack pnpm vitest run tests/unit/monthly-generator.test.ts`
  Expected: FAIL with "Cannot find module '@/server/dal/activities/generator'"

- [ ] **Step 3: Implement `src/server/dal/activities/generator.ts`**
  Implement:
  - `import "server-only";`
  - Date calculation logic for 5 weeks matching `dayOfWeek` (0..6)
  - Topic resolution from `agenda_weekly_topics`
  - Duplicate detection against existing `activities` for that date and schedule
  - Creation of `activities` records with attendance windows and tokens
  - Active members synchronization into `attendance_records`

- [ ] **Step 4: Run test to verify it passes**
  Run: `corepack pnpm vitest run tests/unit/monthly-generator.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit Task 2**

  ```bash
  git add tests/unit/monthly-generator.test.ts src/server/dal/activities/generator.ts
  git commit -m "feat(activities): implement monthly recurring activity generator with unit tests"
  ```

---

### Task 3: Participant Attendance Synchronization & Unit Tests (`tests/unit/attendance-sync.test.ts`)

**Files:**
- Modify: `src/server/dal/activities/generator.ts` (if needed for isolated sync function export)
- Create: `tests/unit/attendance-sync.test.ts`

**Interfaces:**
- Consumes:
  - `syncActivityParticipants(activityId: string, sessionOverride?: UserSession): Promise<number>`
- Produces:
  - Verified baseline attendance records creation for all active members

- [ ] **Step 1: Write failing test in `tests/unit/attendance-sync.test.ts`**
  Write tests covering:
  - Only active members (`memberStatus === 'active'`) receive baseline records
  - Baseline record values: `status = 'absent'`, `attendanceMethod = 'manual'`, `verificationStatus = 'valid'`
  - Inactive, alumni, and moved members are excluded
  - Repeated sync calls do not duplicate records for members already present

- [ ] **Step 2: Run test to verify it fails or passes**
  Run: `corepack pnpm vitest run tests/unit/attendance-sync.test.ts`

- [ ] **Step 3: Implement / Refine `syncActivityParticipants` in `generator.ts`**
  Export `syncActivityParticipants` so it can be used standalone or inside `generateMonthlyActivities`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `corepack pnpm vitest run tests/unit/attendance-sync.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit Task 3**

  ```bash
  git add tests/unit/attendance-sync.test.ts src/server/dal/activities/generator.ts
  git commit -m "feat(activities): implement attendance participant synchronization with unit tests"
  ```

---

### Task 4: Translations Parity (`messages/en-US.json` and `messages/id-ID.json`)

**Files:**
- Modify: `messages/en-US.json`
- Modify: `messages/id-ID.json`

**Interfaces:**
- Add complete translation namespaces:
  - `activities.events`: list, details, status labels, create/edit, column names, attendance pill status
  - `activities.statusDialog`: transition title, status select, change reason label/placeholder, warnings
  - `activities.generator`: wizard title, subtitle, month/year selector, preview table, summary confirmation

- [ ] **Step 1: Add translation keys to `messages/en-US.json`**
- [ ] **Step 2: Add exact mirror keys to `messages/id-ID.json`**
- [ ] **Step 3: Run guardrail test to verify key parity**
  Run: `corepack pnpm test tests/unit/i18n.test.ts tests/guardrails.test.ts`
  Expected: PASS with 100% dictionary parity

- [ ] **Step 4: Commit Task 4**

  ```bash
  git add messages/en-US.json messages/id-ID.json
  git commit -m "chore(i18n): add activities events, lifecycle, and generator translation dictionaries"
  ```

---

### Task 5: Server Actions for Activities & Generator

**Files:**
- Create: `src/features/activities/events/actions.ts`
- Create: `src/features/activities/generator/actions.ts`

**Interfaces:**
- Consumes:
  - `createPermissionActionClient` from `@/lib/safe-action`
  - DAL functions from `@/server/dal/activities/events` and `@/server/dal/activities/generator`
- Produces:
  - `createActivityAction`, `updateActivityAction`, `updateActivityStatusAction`, `deleteActivityAction`
  - `generateMonthlyActivitiesAction`, `getScheduleOccurrencesPreviewAction`

- [ ] **Step 1: Implement `src/features/activities/events/actions.ts`**
  With Zod schemas and permission action clients (`ACTIVITIES_EVENTS_CREATE`, `UPDATE`, `STATUS`, `DELETE`).
- [ ] **Step 2: Implement `src/features/activities/generator/actions.ts`**
  With Zod schemas and permission action clients (`ACTIVITIES_SCHEDULES_GENERATE`).
- [ ] **Step 3: Run typecheck and lint**
  Run: `corepack pnpm typecheck && corepack pnpm lint`
  Expected: PASS

- [ ] **Step 4: Commit Task 5**

  ```bash
  git add src/features/activities/events/actions.ts src/features/activities/generator/actions.ts
  git commit -m "feat(activities): add safe actions for activity events and monthly generator"
  ```

---

### Task 6: UI Components & Views

**Files:**
- Create: `src/features/activities/events/components/activities-table.tsx`
- Create: `src/features/activities/events/components/activity-status-dialog.tsx`
- Create: `src/features/activities/events/components/activity-dialog.tsx`
- Create: `src/features/activities/generator/components/monthly-generator-wizard.tsx`
- Create: `src/app/(dashboard)/activities/page.tsx`
- Create: `src/app/(dashboard)/activities/[id]/page.tsx`
- Create: `src/app/(dashboard)/schedules/[id]/generate/page.tsx`
- Modify: `src/app/(dashboard)/schedules/[id]/page.tsx` (add "Generate Monthly Activities" button link)

- [ ] **Step 1: Implement `activity-status-dialog.tsx`**
  Dialog allowing status selection, requiring `changeReason` for holiday/postponed/relocated/cancelled.
- [ ] **Step 2: Implement `activity-dialog.tsx`**
  Dialog for creating or editing concrete activity.
- [ ] **Step 3: Implement `activities-table.tsx`**
  TanStack table with date badges, 6-state status badges, attendance status pills (`Open`, `Not Open`, `Closed`), search, status filter.
- [ ] **Step 4: Implement `src/app/(dashboard)/activities/page.tsx`**
  Server component with page header, permissions guard, and `ActivitiesTable`.
- [ ] **Step 5: Implement `src/app/(dashboard)/activities/[id]/page.tsx`**
  Activity detail page with status transition dialog, attendance summary, PIC, department, and token display.
- [ ] **Step 6: Implement `monthly-generator-wizard.tsx` & `src/app/(dashboard)/schedules/[id]/generate/page.tsx`**
  Wizard with month/year picker, calculated occurrences preview table with week-by-week checkboxes and topics, and generation confirmation.
- [ ] **Step 7: Update `src/app/(dashboard)/schedules/[id]/page.tsx`**
  Add button link to `/schedules/${schedule.id}/generate`.
- [ ] **Step 8: Run typecheck, lint, and build**
  Run: `corepack pnpm typecheck && corepack pnpm lint && corepack pnpm build`
  Expected: PASS

- [ ] **Step 9: Commit Task 6**

  ```bash
  git add src/features/activities/ src/app/\(dashboard\)/activities/ src/app/\(dashboard\)/schedules/
  git commit -m "feat(activities): implement activities list, detail with status dialog, and generation wizard UI"
  ```

---

### Task 7: Full Verification Suite, Pull Request & Issue Completion

- [ ] **Step 1: Run format, check, and build**

  ```bash
  corepack pnpm format
  corepack pnpm check
  corepack pnpm build
  ```
- [ ] **Step 2: Push branch**

  ```bash
  git push -u origin feat/issue-12-activities-and-generator
  ```
- [ ] **Step 3: Create PR targeting `main` with `Closes #24`**

  ```bash
  gh pr create --title "feat(activities): implement activity lifecycle management, monthly recurring generator, and attendance participant synchronization" --body "Closes #24 ..." --base main
  ```
- [ ] **Step 4: Post completion comment on GitHub Issue #24**

  ```bash
  gh issue comment 24 --body "Implementation complete. Opened PR #<PR_NUMBER> for review."
  ```
