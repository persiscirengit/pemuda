# Domain Glossary

This glossary defines canonical organizational terminology in US English (`en-US`) for the Pemuda Persis Cirengit platform. All contributors and agents must use these terms consistently across database schema columns, TypeScript types, routes, and documentation.

## Core Entities

| Term                       | Category      | Description                                                                   | Canonical Identifier      |
| -------------------------- | ------------- | ----------------------------------------------------------------------------- | ------------------------- |
| **Department**             | Organization  | Functional committee or divisional unit (e.g. Education, Da'wah, Cadres).     | `departments`             |
| **Position**               | Organization  | Official leadership or staff office held by a member in a department.         | `positions`               |
| **Member**                 | Membership    | An active registered organizational member.                                   | `members`                 |
| **Member Number (NPA)**    | Membership    | Official national member identification code (NPA).                           | `member_number` / `npa`   |
| **Agenda Schedule**        | Activities    | Recurring template or calendar definition for periodic events.                | `agenda_schedules`        |
| **Activity**               | Activities    | Concrete scheduled or completed event, study circle, or meeting.              | `activities`              |
| **Attendance**             | Activities    | Verified presence record of a member at an activity (via QR, GPS, or manual). | `attendance_records`      |
| **Membership Fee**         | Finance       | Periodic monthly organizational dues assessed to registered members.          | `membership_fees`         |
| **Financial Transaction**  | Finance       | General ledger record documenting income or expenditure.                      | `financial_transactions`  |
| **Article**                | Content       | Educational article, study summary, or organizational announcement.           | `articles`                |
| **Broadcast Notification** | Notifications | Mass communication delivered via Web Push and in-app alerts.                  | `broadcast_notifications` |

## Starter Roles

The platform authorization model is strictly dynamic and permission-based, with five standardized starter role templates:

| Role Identifier | Title                | Primary Responsibility                                                     |
| --------------- | -------------------- | -------------------------------------------------------------------------- |
| `super_admin`   | System Administrator | System settings, user accounts, and infrastructure operations.             |
| `chairperson`   | Chairperson          | Executive oversight across all departments, activities, and approvals.     |
| `secretary`     | Secretary            | Membership rosters, minutes, official articles, and activity logs.         |
| `treasurer`     | Treasurer            | Financial ledgers, fee collections, transactions, and financial reports.   |
| `member`        | Member               | Standard member self-service portal, attendance check-in, and fee history. |

## Localization and Naming Rule

All internal symbols, code files, and schema keys must remain in English as listed above. User interface labels in Indonesian are loaded dynamically via `next-intl` translation keys (e.g. `messages/id-ID.json`).
