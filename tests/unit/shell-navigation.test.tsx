// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
});

import { NextIntlClientProvider } from "next-intl";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/features/shell/components/app-sidebar";
import {
  getVisibleNavSections,
  NAV_SECTIONS,
} from "@/features/shell/nav-config";
import { PERMISSIONS } from "@/lib/permissions";
import enMessages from "../../messages/en-US.json";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en-US" messages={enMessages}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>,
  );
}

describe("Officer-as-Member Unified Shell Navigation", () => {
  const memberPermissions = [
    PERMISSIONS.ACTIVITIES_CHECKIN_SELF,
    PERMISSIONS.FINANCE_FEES_SELF,
    PERMISSIONS.NOTIFICATIONS_INBOX_SELF,
    PERMISSIONS.NOTIFICATIONS_PREFERENCES_SELF,
    PERMISSIONS.NOTIFICATIONS_PUSH_SELF,
  ];

  const officerPermissions = [
    ...memberPermissions,
    PERMISSIONS.ORGANIZATION_DEPARTMENTS_READ,
    PERMISSIONS.ORGANIZATION_MEMBERS_READ,
    PERMISSIONS.ACTIVITIES_SCHEDULES_READ,
    PERMISSIONS.ACTIVITIES_EVENTS_READ,
    PERMISSIONS.ACTIVITIES_ATTENDANCE_READ,
    PERMISSIONS.FINANCE_TRANSACTIONS_READ,
    PERMISSIONS.FINANCE_FEES_READ,
    PERMISSIONS.CONTENT_ARTICLES_READ,
    PERMISSIONS.NOTIFICATIONS_BROADCASTS_READ,
    PERMISSIONS.ORGANIZATION_SETTINGS_READ,
  ];

  describe("Permission Filtering (ADR 003: Zero Role Name Checks)", () => {
    it("users with only member permissions see self-service items and zero admin links", () => {
      const visibleSections = getVisibleNavSections(
        NAV_SECTIONS,
        memberPermissions,
        true, // hasMemberLink
      );

      const allPaths = visibleSections.flatMap((s) =>
        s.items.map((i) => i.href),
      );

      // Self-service items must be visible
      expect(allPaths).toContain("/dashboard");
      expect(allPaths).toContain("/dashboard/check-in");
      expect(allPaths).toContain("/dashboard/my-fees");

      // Administrative items must NOT be visible
      expect(allPaths).not.toContain("/dashboard/departments");
      expect(allPaths).not.toContain("/dashboard/members");
      expect(allPaths).not.toContain("/dashboard/schedules");
      expect(allPaths).not.toContain("/dashboard/attendances");
      expect(allPaths).not.toContain("/dashboard/finance");
      expect(allPaths).not.toContain("/dashboard/finance/fees");
      expect(allPaths).not.toContain("/dashboard/articles");
      expect(allPaths).not.toContain("/dashboard/settings");
    });

    it("officers with administrative permissions see both administrative and member self-service items", () => {
      const visibleSections = getVisibleNavSections(
        NAV_SECTIONS,
        officerPermissions,
        true, // hasMemberLink
      );

      const allPaths = visibleSections.flatMap((s) =>
        s.items.map((i) => i.href),
      );

      // Administrative items present
      expect(allPaths).toContain("/dashboard/departments");
      expect(allPaths).toContain("/dashboard/members");
      expect(allPaths).toContain("/dashboard/schedules");
      expect(allPaths).toContain("/dashboard/activities");
      expect(allPaths).toContain("/dashboard/attendances");
      expect(allPaths).toContain("/dashboard/finance");
      expect(allPaths).toContain("/dashboard/finance/fees");
      expect(allPaths).toContain("/dashboard/articles");
      expect(allPaths).toContain("/dashboard/notifications");
      expect(allPaths).toContain("/dashboard/settings");

      // Concurrently retained member self-service items
      expect(allPaths).toContain("/dashboard/check-in");
      expect(allPaths).toContain("/dashboard/my-fees");
    });

    it("hides member-specific workflows when user is not linked to a member record", () => {
      const visibleSections = getVisibleNavSections(
        NAV_SECTIONS,
        officerPermissions,
        false, // not linked to member record
      );

      const allPaths = visibleSections.flatMap((s) =>
        s.items.map((i) => i.href),
      );

      // Items with requiresMemberLink must be hidden
      expect(allPaths).not.toContain("/dashboard/check-in");
      expect(allPaths).not.toContain("/dashboard/my-fees");

      // Administrative items remain visible
      expect(allPaths).toContain("/dashboard/departments");
    });

    it("filters sections with zero visible items", () => {
      const singlePerm = [PERMISSIONS.CONTENT_ARTICLES_READ];
      const visibleSections = getVisibleNavSections(
        NAV_SECTIONS,
        singlePerm,
        false,
      );

      const sectionKeys = visibleSections.map((s) => s.sectionKey);
      expect(sectionKeys).toContain("content");
      expect(sectionKeys).toContain("overview"); // overview has public /dashboard
      expect(sectionKeys).not.toContain("organization");
      expect(sectionKeys).not.toContain("finance");
    });
  });

  describe("Sidebar Component Rendering", () => {
    it("renders navigation links and user profile trigger in the sidebar", () => {
      const mockUser = {
        name: "Ahmad Officer",
        email: "ahmad@pemuda.local",
        username: "NPA-12345",
      };

      renderWithIntl(
        <SidebarProvider defaultOpen={true}>
          <AppSidebar
            user={mockUser}
            permissions={officerPermissions}
            hasMemberLink={true}
          />
        </SidebarProvider>,
      );

      expect(screen.getByText("Pemuda Persis Cirengit")).toBeDefined();
      expect(screen.getByText("Ahmad Officer")).toBeDefined();
      expect(
        screen.getAllByText("Field Check-In").length,
      ).toBeGreaterThanOrEqual(1);
    });
  });
});
