import {
  Bell,
  Building2,
  Calendar,
  FileText,
  LayoutDashboard,
  type LucideIcon,
  QrCode,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { PERMISSIONS } from "@/lib/permissions";

export type NavigationMessageKey =
  | "overview"
  | "dashboard"
  | "selfCheckIn"
  | "organization"
  | "departments"
  | "members"
  | "activities"
  | "agendaSchedules"
  | "activitiesList"
  | "attendanceManage"
  | "finance"
  | "financialLedger"
  | "membershipFees"
  | "myFees"
  | "content"
  | "articles"
  | "notifications"
  | "settings"
  | "broadcasts"
  | "systemSettings"
  | "profile";

export interface NavItem {
  titleKey: NavigationMessageKey;
  href: string;
  icon: LucideIcon;
  permission?: string; // Optional: if omitted, accessible to all authenticated users
  requiresMemberLink?: boolean; // True if item requires user to be linked to a member record
}

export interface NavSection {
  sectionKey: NavigationMessageKey;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    sectionKey: "overview",
    items: [
      {
        titleKey: "dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
      },
      {
        titleKey: "selfCheckIn",
        href: "/dashboard/check-in",
        icon: QrCode,
        permission: PERMISSIONS.ACTIVITIES_CHECKIN_SELF,
        requiresMemberLink: true,
      },
    ],
  },
  {
    sectionKey: "organization",
    items: [
      {
        titleKey: "departments",
        href: "/dashboard/departments",
        icon: Building2,
        permission: PERMISSIONS.ORGANIZATION_DEPARTMENTS_READ,
      },
      {
        titleKey: "members",
        href: "/dashboard/members",
        icon: Users,
        permission: PERMISSIONS.ORGANIZATION_MEMBERS_READ,
      },
    ],
  },
  {
    sectionKey: "activities",
    items: [
      {
        titleKey: "agendaSchedules",
        href: "/dashboard/schedules",
        icon: Calendar,
        permission: PERMISSIONS.ACTIVITIES_SCHEDULES_READ,
      },
      {
        titleKey: "activitiesList",
        href: "/dashboard/activities",
        icon: Calendar,
        permission: PERMISSIONS.ACTIVITIES_EVENTS_READ,
      },
      {
        titleKey: "attendanceManage",
        href: "/dashboard/attendances",
        icon: QrCode,
        permission: PERMISSIONS.ACTIVITIES_ATTENDANCE_READ,
      },
    ],
  },
  {
    sectionKey: "finance",
    items: [
      {
        titleKey: "financialLedger",
        href: "/dashboard/finance",
        icon: Wallet,
        permission: PERMISSIONS.FINANCE_TRANSACTIONS_READ,
      },
      {
        titleKey: "membershipFees",
        href: "/dashboard/finance/fees",
        icon: Wallet,
        permission: PERMISSIONS.FINANCE_FEES_READ,
      },
      {
        titleKey: "myFees",
        href: "/dashboard/my-fees",
        icon: Wallet,
        permission: PERMISSIONS.FINANCE_FEES_SELF,
        requiresMemberLink: true,
      },
    ],
  },
  {
    sectionKey: "content",
    items: [
      {
        titleKey: "articles",
        href: "/dashboard/articles",
        icon: FileText,
        permission: PERMISSIONS.CONTENT_ARTICLES_READ,
      },
    ],
  },
  {
    sectionKey: "settings",
    items: [
      {
        titleKey: "broadcasts",
        href: "/dashboard/notifications",
        icon: Bell,
        permission: PERMISSIONS.NOTIFICATIONS_BROADCASTS_READ,
      },
      {
        titleKey: "systemSettings",
        href: "/dashboard/settings",
        icon: Settings,
        permission: PERMISSIONS.ORGANIZATION_SETTINGS_READ,
      },
    ],
  },
];

/**
 * Evaluates visibility of navigation sections and items strictly based on granted permissions
 * and member record association. Never compares role names (Law 4 & ADR 003).
 */
export function getVisibleNavSections(
  sections: readonly NavSection[],
  userPermissions: readonly string[] | string[],
  hasMemberLink: boolean,
): NavSection[] {
  const permSet = new Set(userPermissions);

  return sections
    .map((section) => {
      const visibleItems = section.items.filter((item) => {
        if (item.requiresMemberLink && !hasMemberLink) {
          return false;
        }
        if (item.permission && !permSet.has(item.permission)) {
          return false;
        }
        return true;
      });

      return {
        sectionKey: section.sectionKey,
        items: visibleItems,
      };
    })
    .filter((section) => section.items.length > 0);
}
