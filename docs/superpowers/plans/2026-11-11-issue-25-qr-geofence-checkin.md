<!-- cspell:ignore geolib qrcode yudiel safeaction hookform shadcn nuqs Geofenced geofenced checkin geofence Geolocation Geofence viewports geolocation CHECKIN unreviewed Upserts Hadir Izin -->
# QR Code Generation, GPS Geofenced Check-In & Member Leave Requests Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement activity QR code token display with live clock and regeneration, Geolib-based GPS geofenced mobile check-in (`/attendance/check-in/[token]`), member leave/absence requests, and atomic DAL upsert logic for GitHub Issue #25.

**Architecture:** Layered architecture adhering to the project's 6 Laws and ADRs:
1. Data access layer in `src/server/dal/activities/checkin.ts` guarded by `"server-only"` and granular RBAC (`requirePermission`).
2. Calculation of member-to-venue distance strictly powered by `geolib.getDistance` (zero bespoke Haversine spherical math).
3. Printable dynamic QR code generator using `qrcode.react` with live countdown clock and token regeneration action.
4. Mobile-first check-in UI (`size="lg"` CTAs) querying `navigator.geolocation` and submitting coordinates and accuracy via type-safe server actions (`next-safe-action`).
5. Absence request workflow capturing mandatory justification notes within an open attendance window.
6. 100% dictionary parity between `messages/en-US.json` and `messages/id-ID.json` with zero hardcoded JSX text.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Drizzle ORM, PostgreSQL, `geolib@latest`, `qrcode.react@latest`, `@yudiel/react-qr-scanner@latest`, `next-safe-action`, `next-intl`, Tailwind CSS v4, Lucide React, Vitest.

**Spec:** GitHub Issue #25 (`feat(attendance): implement QR token generation, Geolib GPS geofenced check-in, and member leave requests`).

---

## Global Constraints

- Every DAL file MUST declare `import "server-only";` at line 1 and call `requirePermission()` (Law 4).
- Permission check: Check-in actions must require `PERMISSIONS.ACTIVITIES_CHECKIN_SELF` (Law 4).
- Token regeneration must require `PERMISSIONS.ACTIVITIES_EVENTS_UPDATE` (Law 4).
- Anti-Primitive Discipline: Zero bespoke Haversine calculations (must use `geolib`), zero raw HTML `<canvas>` QR primitives (must use `qrcode.react`), zero bespoke camera video primitives (must use `@yudiel/react-qr-scanner`) (Law 6).
- UI Governance: Use Shadcn / Radix-Nova primitives (`Button`, `Card`, `Dialog`, `Textarea`, `Badge`). Raw `<button>`, `<input>`, `<select>`, `<textarea>` are strictly banned (Law 1).
- Mobile field CTA: Primary touch buttons must render with `size="lg"` for field ergonomics (Law 1).
- Strict i18n: Zero hardcoded strings in JSX. 100% dictionary key parity between `messages/en-US.json` and `messages/id-ID.json` (Law 2).
- Server Actions: All mutations must use `createPermissionActionClient` or `authActionClient` from `@/lib/safe-action` (Law 6).
- TDD Iron Law: Write failing unit test first, confirm expected failure, implement minimal code to pass, verify green.

---

## Review Focus

1. **Window Boundaries**: Check-in attempts when `attendanceEnabled = false`, before `attendanceOpenAt`, or after `attendanceCloseAt` must be rejected with descriptive localized errors.
2. **Geofence Boundary Conditions**: Member coordinates exactly on the radius boundary ($\le \text{attendanceRadius}$) must be marked `status = 'present'` and `verification_status = 'valid'`. Coordinates strictly beyond ($> \text{attendanceRadius}$) must be marked `status = 'need_verification'` and `verification_status = 'need_verification'`.
3. **Distance Precision**: Distance must be recorded as a floating-point number rounded to 2 decimal places (`numeric(10, 2)`).
4. **Idempotency & Re-check-in Rules**: If a member already has a record marked `absent` (pre-synced) or unreviewed `need_verification`, updates must succeed; if a record is already marked `present` or verified `permission`, re-check-in must be rejected.
5. **Absence Request Validation**: Member absence request requires open attendance window and non-empty `reason` (max 500 characters). Coordinates are omitted and verification status is set to `valid`.

---

## File Structure & Responsibilities

```
src/
├── app/
│   ├── (dashboard)/
│   │   └── activities/
│   │       └── [id]/
│   │           └── qr/
│   │               └── page.tsx           # Organizer printable QR page with live clock & token regeneration
│   └── attendance/
│       └── check-in/
│           └── [token]/
│               └── page.tsx               # Member field check-in page & absence form
├── features/
│   └── activities/
│       ├── checkin/
│       │   ├── actions.ts                 # Safe server actions for check-in & absence submission
│       │   ├── types.ts                   # Schemas and types for check-in & absence
│       │   └── components/
│       │       ├── checkin-client.tsx     # Client coordinator handling tabs (Check-In vs Absence)
│       │       ├── checkin-form.tsx       # Geolocation grabber, distance calculator, size="lg" button
│       │       ├── leave-request-form.tsx # Form with 500-char textarea for absence reason
│       │       └── distance-badge.tsx     # Visual badge displaying distance from venue & status
│       └── qr/
│           ├── actions.ts                 # Safe server action to regenerate attendance token
│           └── components/
│               ├── qr-display-card.tsx    # Printable QR display using qrcode.react & activity info
│               ├── live-clock.tsx         # Real-time ticking clock component
│               └── token-regenerate-dialog.tsx # Confirmation dialog to rotate compromised tokens
└── server/
    └── dal/
        └── activities/
            └── checkin.ts                 # Core DAL: check-in, geofence, leave request, token rotation
tests/
└── unit/
    ├── checkin-geofence.test.ts           # Geofence distance, window, radius, retry rules unit tests
    └── leave-request.test.ts              # Absence request validation, window, reason length tests
```

---

## Task Decomposition

### Task 1: Install Designated Dependencies (@latest)

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: npm registry
- Produces: `geolib`, `qrcode.react`, `@yudiel/react-qr-scanner` installed at `@latest`

- [ ] **Step 1: Install packages via corepack pnpm**
  Run: `corepack pnpm add geolib@latest qrcode.react@latest @yudiel/react-qr-scanner@latest`
  Expected: Packages added to `dependencies` in `package.json`.

- [ ] **Step 2: Verify package installation & typecheck**
  Run: `corepack pnpm typecheck`
  Expected: PASS with 0 type errors.

- [ ] **Step 3: Verify guardrails for banned packages**
  Run: `corepack pnpm check:guardrails`
  Expected: All 6 laws passed with 0 violations.

- [ ] **Step 4: Commit Task 1**
  ```bash
  git add package.json pnpm-lock.yaml
  git commit -m "chore(deps): install geolib, qrcode.react, and react-qr-scanner at latest"
  ```

---

### Task 2: Geofence Check-In DAL (`src/server/dal/activities/checkin.ts`) & Unit Tests (`tests/unit/checkin-geofence.test.ts`)

**Files:**
- Create: `src/server/dal/activities/checkin.ts`
- Create: `tests/unit/checkin-geofence.test.ts`

**Interfaces:**
- Consumes:
  - `PERMISSIONS` from `@/lib/permissions`
  - `requirePermission`, `UserSession`, `UnauthorizedError`, `UnauthenticatedError` from `@/server/dal/auth`
  - `MemberNotLinkedError` from `@/server/dal/members/portal`
  - `activities`, `attendanceRecords` from `@/db/schema/activities`
  - `users`, `members` from `@/db/schema`
  - `getDistance` from `geolib`
  - `generateAttendanceToken` from `@/server/dal/activities/events`
- Produces:
  - `submitMemberCheckIn(token: string, coords: CheckInCoordinatesInput, sessionOverride?: UserSession): Promise<CheckInResult>`
  - `getActivityByAttendanceToken(token: string, sessionOverride?: UserSession): Promise<ActivityCheckInDetails | null>`
  - `regenerateAttendanceToken(activityId: string, sessionOverride?: UserSession): Promise<{ activityId: string; attendanceToken: string }>`

- [ ] **Step 1: Write failing unit test in `tests/unit/checkin-geofence.test.ts`**
  Covering:
  - `"server-only"` import enforcement
  - Rejects if unauthenticated or missing `ACTIVITIES_CHECKIN_SELF`
  - Rejects with `MemberNotLinkedError` if user is not linked to a member record
  - Rejects if activity does not exist or `attendanceEnabled = false`
  - Rejects if current time is before `attendanceOpenAt`
  - Rejects if current time is after `attendanceCloseAt`
  - Distance $\le \text{attendanceRadius}$: assigns `status = 'present'`, `verification_status = 'valid'`
  - Distance $> \text{attendanceRadius}$: assigns `status = 'need_verification'`, `verification_status = 'need_verification'`
  - Verifies distance calculation uses `geolib.getDistance` and rounds to 2 decimal places
  - Idempotency & retry rules: allows updating records in status `'absent'` or unreviewed `'need_verification'`; rejects updating already `'present'` or valid `'permission'`
  - `regenerateAttendanceToken`: requires `ACTIVITIES_EVENTS_UPDATE`, generates fresh 64-character token

- [ ] **Step 2: Run test to verify it fails**
  Run: `corepack pnpm vitest run tests/unit/checkin-geofence.test.ts`
  Expected: FAIL with "Cannot find module '@/server/dal/activities/checkin'"

- [ ] **Step 3: Implement `src/server/dal/activities/checkin.ts`**
  Implement:
  - `import "server-only";`
  - Type definitions: `CheckInCoordinatesInput`, `CheckInResult`, `ActivityCheckInDetails`
  - Helper to resolve user memberId or throw `MemberNotLinkedError`
  - `submitMemberCheckIn`:
    1. Check permission `PERMISSIONS.ACTIVITIES_CHECKIN_SELF`.
    2. Resolve `memberId`.
    3. Query activity by `attendanceToken`. Check `attendanceEnabled` and open window `[attendanceOpenAt, attendanceCloseAt]`.
    4. Compute distance via `geolib.getDistance`. Round to 2 decimal places.
    5. Determine status (`distance <= radius ? 'present' : 'need_verification'`) and verification status (`distance <= radius ? 'valid' : 'need_verification'`).
    6. Check existing attendance record for `(activityId, memberId)`. Reject if already `'present'`.
    7. Upsert record with coordinates, distance, accuracy, method (`'qr'` or `'link'`), checkedInAt timestamp.
  - `getActivityByAttendanceToken`: Returns activity info and user's existing attendance status if logged in.
  - `regenerateAttendanceToken`: Check permission `PERMISSIONS.ACTIVITIES_EVENTS_UPDATE`, generates token via `generateAttendanceToken()`, updates activity, returns new token.

- [ ] **Step 4: Run test to verify it passes**
  Run: `corepack pnpm vitest run tests/unit/checkin-geofence.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit Task 2**
  ```bash
  git add tests/unit/checkin-geofence.test.ts src/server/dal/activities/checkin.ts
  git commit -m "feat(attendance): implement geofence check-in DAL with geolib distance calculations and unit tests"
  ```

---

### Task 3: Member Leave Request DAL & Unit Tests (`tests/unit/leave-request.test.ts`)

**Files:**
- Modify: `src/server/dal/activities/checkin.ts`
- Create: `tests/unit/leave-request.test.ts`

**Interfaces:**
- Consumes:
  - `submitMemberPermission` from `src/server/dal/activities/checkin.ts`
- Produces:
  - `submitMemberPermission(token: string, input: LeaveRequestInput, sessionOverride?: UserSession): Promise<AttendanceRecord>`

- [ ] **Step 1: Write failing unit test in `tests/unit/leave-request.test.ts`**
  Covering:
  - Rejects if unauthenticated or missing `ACTIVITIES_CHECKIN_SELF`
  - Rejects with `MemberNotLinkedError` if unlinked
  - Rejects empty, whitespace-only, or missing `reason`
  - Rejects `reason` exceeding 500 characters
  - Rejects if activity attendance window is closed (`now < attendanceOpenAt` or `now > attendanceCloseAt`)
  - Successfully creates or updates record with `status = 'permission'`, `verification_status = 'valid'`, `notes = reason.trim()`, and null coordinates

- [ ] **Step 2: Run test to verify it fails**
  Run: `corepack pnpm vitest run tests/unit/leave-request.test.ts`
  Expected: FAIL with "submitMemberPermission is not a function"

- [ ] **Step 3: Implement `submitMemberPermission` in `src/server/dal/activities/checkin.ts`**
  Implement:
  - Validate `input.reason`: string trimmed, $1 \le \text{length} \le 500$.
  - Permission check `PERMISSIONS.ACTIVITIES_CHECKIN_SELF`.
  - Resolve `memberId`.
  - Validate activity open window.
  - Upsert record: `status: 'permission'`, `verificationStatus: 'valid'`, `notes: reason.trim()`, `checkedInAt: new Date()`, `attendanceMethod: 'link'`.

- [ ] **Step 4: Run test to verify it passes**
  Run: `corepack pnpm vitest run tests/unit/leave-request.test.ts`
  Expected: PASS

- [ ] **Step 5: Commit Task 3**
  ```bash
  git add tests/unit/leave-request.test.ts src/server/dal/activities/checkin.ts
  git commit -m "feat(attendance): implement member absence request workflow and unit tests"
  ```

---

### Task 4: Safe Server Actions (`src/features/activities/checkin/actions.ts` & `src/features/activities/qr/actions.ts`)

**Files:**
- Create: `src/features/activities/checkin/types.ts`
- Create: `src/features/activities/checkin/actions.ts`
- Create: `src/features/activities/qr/actions.ts`

**Interfaces:**
- Consumes:
  - `createPermissionActionClient` from `@/lib/safe-action`
  - `PERMISSIONS` from `@/lib/permissions`
  - `submitMemberCheckIn`, `submitMemberPermission`, `regenerateAttendanceToken` from `@/server/dal/activities/checkin`
- Produces:
  - `submitMemberCheckInAction`
  - `submitMemberPermissionAction`
  - `regenerateAttendanceTokenAction`

- [ ] **Step 1: Define Zod validation schemas in `src/features/activities/checkin/types.ts`**
  ```typescript
  export const checkInSchema = z.object({
    token: z.string().min(10).max(64),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    locationAccuracy: z.number().nonnegative().optional(),
    method: z.enum(["qr", "link"]).default("link"),
  });

  export const leaveRequestSchema = z.object({
    token: z.string().min(10).max(64),
    reason: z.string().trim().min(1, "Reason is required").max(500, "Maximum 500 characters"),
  });
  ```

- [ ] **Step 2: Implement server actions in `src/features/activities/checkin/actions.ts`**
  - Implement `submitMemberCheckInAction` using `createPermissionActionClient(PERMISSIONS.ACTIVITIES_CHECKIN_SELF)`.
  - Revalidate `/attendance/check-in/[token]`, `/check-in`, `/activities/[id]`.
  - Implement `submitMemberPermissionAction` using `createPermissionActionClient(PERMISSIONS.ACTIVITIES_CHECKIN_SELF)`.
  - Revalidate paths.

- [ ] **Step 3: Implement server action in `src/features/activities/qr/actions.ts`**
  - Implement `regenerateAttendanceTokenAction` using `createPermissionActionClient(PERMISSIONS.ACTIVITIES_EVENTS_UPDATE)`.
  - Revalidate `/activities/[id]/qr` and `/activities/[id]`.

- [ ] **Step 4: Typecheck actions**
  Run: `corepack pnpm typecheck`
  Expected: PASS

- [ ] **Step 5: Commit Task 4**
  ```bash
  git add src/features/activities/checkin/types.ts src/features/activities/checkin/actions.ts src/features/activities/qr/actions.ts
  git commit -m "feat(attendance): create type-safe server actions for check-in, absence, and token rotation"
  ```

---

### Task 5: i18n Localization Messages (`messages/en-US.json` and `messages/id-ID.json`)

**Files:**
- Modify: `messages/en-US.json`
- Modify: `messages/id-ID.json`

**Interfaces:**
- Consumes: i18n keys for QR display, field check-in, distance feedback, absence request
- Produces: Identical keys in `messages/en-US.json` and `messages/id-ID.json` under `attendance.checkin` and `attendance.qr`

- [ ] **Step 1: Add translation keys to `messages/en-US.json`**
  Add keys under `attendance`:
  - `qr.title`, `qr.subtitle`, `qr.liveClock`, `qr.regenerateToken`, `qr.regenerateConfirmTitle`, `qr.regenerateConfirmDesc`, `qr.tokenRegenerated`, `qr.printNotice`, `qr.openUntil`
  - `checkin.title`, `checkin.subtitle`, `checkin.requestingLocation`, `checkin.locationDenied`, `checkin.locationUnavailable`, `checkin.distanceFromVenue`, `checkin.btnCheckIn`, `checkin.checkingIn`, `checkin.successTitle`, `checkin.successValid`, `checkin.successNeedVerification`, `checkin.alreadyRecorded`, `checkin.windowClosed`, `checkin.windowNotOpen`, `checkin.absenceTab`, `checkin.reasonLabel`, `checkin.reasonPlaceholder`, `checkin.reasonRequired`, `checkin.btnSubmitAbsence`, `checkin.submittingAbsence`, `checkin.absenceRecorded`, `checkin.scanQrButton`, `checkin.cameraPermissionDenied`

- [ ] **Step 2: Add exact matching Indonesian translation keys to `messages/id-ID.json`**
  Ensure 100% key parity and natural Indonesian terminology.

- [ ] **Step 3: Verify guardrails messages parity**
  Run: `corepack pnpm check:guardrails`
  Expected: Law 2 passes with 0 parity violations.

- [ ] **Step 4: Commit Task 5**
  ```bash
  git add messages/en-US.json messages/id-ID.json
  git commit -m "feat(attendance): add localized UI messages for QR display and field check-in"
  ```

---

### Task 6: Organizer QR Code Display View (`src/app/(dashboard)/activities/[id]/qr/page.tsx` & `src/features/activities/qr/**`)

**Files:**
- Create: `src/features/activities/qr/components/live-clock.tsx`
- Create: `src/features/activities/qr/components/token-regenerate-dialog.tsx`
- Create: `src/features/activities/qr/components/qr-display-card.tsx`
- Create: `src/app/(dashboard)/activities/[id]/qr/page.tsx`
- Modify: `src/app/(dashboard)/activities/[id]/page.tsx` (add button linking to QR view)

**Interfaces:**
- Consumes:
  - `qrcode.react` (`QRCodeSVG`)
  - `getActivityById` from `@/server/dal/activities/events`
  - `regenerateAttendanceTokenAction` from `@/features/activities/qr/actions`
- Produces:
  - Fullscreen printable printable QR page at `/dashboard/activities/[id]/qr`
  - Quick action button on `/dashboard/activities/[id]`

- [ ] **Step 1: Implement `LiveClock` in `src/features/activities/qr/components/live-clock.tsx`**
  Client component rendering formatted live ticking time with timezone indicator using standard Shadcn Badge/typography.

- [ ] **Step 2: Implement `TokenRegenerateDialog` in `src/features/activities/qr/components/token-regenerate-dialog.tsx`**
  Shadcn `Dialog` with confirmation prompt invoking `regenerateAttendanceTokenAction`.

- [ ] **Step 3: Implement `QrDisplayCard` in `src/features/activities/qr/components/qr-display-card.tsx`**
  Renders printable card with `QRCodeSVG`, venue coordinates, attendance window hours, and print CSS utility (`window.print()`).

- [ ] **Step 4: Implement Route Page `src/app/(dashboard)/activities/[id]/qr/page.tsx`**
  - Verify session & permission `ACTIVITIES_EVENTS_READ`.
  - Fetch activity with `getActivityById(id)`.
  - Render `PageHeader`, `LiveClock`, `QrDisplayCard`, and regeneration action.

- [ ] **Step 5: Add Link from Activity Detail Page `src/app/(dashboard)/activities/[id]/page.tsx`**
  Add a QR Code button in `ActivityTokenDisplay` or `ActivityDetailHeaderActions` pointing to `/activities/[id]/qr`.

- [ ] **Step 6: Run typecheck and guardrails**
  Run: `corepack pnpm typecheck && corepack pnpm check:guardrails`
  Expected: PASS

- [ ] **Step 7: Commit Task 6**
  ```bash
  git add src/features/activities/qr/ src/app/\(dashboard\)/activities/\[id\]/qr/ src/app/\(dashboard\)/activities/\[id\]/page.tsx
  git commit -m "feat(attendance): implement organizer activity QR display view with printable layout and token regeneration"
  ```

---

### Task 7: Member Field Check-In View (`src/app/attendance/check-in/[token]/page.tsx` & `src/features/activities/checkin/**`)

**Files:**
- Create: `src/features/activities/checkin/components/distance-badge.tsx`
- Create: `src/features/activities/checkin/components/checkin-form.tsx`
- Create: `src/features/activities/checkin/components/leave-request-form.tsx`
- Create: `src/features/activities/checkin/components/checkin-client.tsx`
- Create: `src/app/attendance/check-in/[token]/page.tsx`

**Interfaces:**
- Consumes:
  - `getActivityByAttendanceToken` from `@/server/dal/activities/checkin`
  - `submitMemberCheckInAction`, `submitMemberPermissionAction` from `@/features/activities/checkin/actions`
  - `geolib.getDistance`
- Produces:
  - Responsive mobile-first field check-in page at `/attendance/check-in/[token]`

- [ ] **Step 1: Implement `DistanceBadge` in `src/features/activities/checkin/components/distance-badge.tsx`**
  Displays distance from venue (e.g. `24m from venue`) with status indicator (green badge if $\le \text{radius}$, amber if outside).

- [ ] **Step 2: Implement `CheckInForm` in `src/features/activities/checkin/components/checkin-form.tsx`**
  - Uses `navigator.geolocation.getCurrentPosition` with high accuracy options.
  - Computes and previews distance via `geolib.getDistance`.
  - Primary check-in button with `size="lg"` for touch ergonomics.
  - Submits coordinates through `submitMemberCheckInAction`.

- [ ] **Step 3: Implement `LeaveRequestForm` in `src/features/activities/checkin/components/leave-request-form.tsx`**
  - Form with 500-character max `Textarea`.
  - Submits excuse through `submitMemberPermissionAction`.

- [ ] **Step 4: Implement `CheckInClient` coordinator in `src/features/activities/checkin/components/checkin-client.tsx`**
  Tabs layout switching between "Hadir (Check-In)" and "Izin (Absence Request)".

- [ ] **Step 5: Implement Route Page `src/app/attendance/check-in/[token]/page.tsx`**
  - Validates session: redirects unauthenticated users to `/login?callbackUrl=...`.
  - Resolves activity details by token.
  - Handles expired window or unlinked member states with clear alerts.
  - Renders `CheckInClient`.

- [ ] **Step 6: Run typecheck and guardrails**
  Run: `corepack pnpm typecheck && corepack pnpm check:guardrails`
  Expected: PASS

- [ ] **Step 7: Commit Task 7**
  ```bash
  git add src/features/activities/checkin/ src/app/attendance/check-in/\[token\]/page.tsx
  git commit -m "feat(attendance): implement mobile field check-in and leave request pages"
  ```

---

### Task 8: Full Verification Suite

**Files:**
- None (verification phase)

- [ ] **Step 1: Run comprehensive verification**
  Run: `corepack pnpm check`
  Expected:
  - `pnpm typecheck` (tsc 0 errors)
  - `pnpm lint` (biome 0 errors)
  - `pnpm check:spell` (cspell 0 errors)
  - `pnpm check:guardrails` (0 violations across all 6 laws)
  - `pnpm test` (all unit test suites pass, including `checkin-geofence.test.ts` and `leave-request.test.ts`)

- [ ] **Step 2: Run Next.js production build**
  Run: `corepack pnpm build`
  Expected: Exit code 0, all static and dynamic routes compiled successfully.

- [ ] **Step 3: Final branch verification & git status check**
  Run: `git status`
  Expected: Clean working tree.
