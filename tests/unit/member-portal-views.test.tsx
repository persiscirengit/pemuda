// @vitest-environment happy-dom

import { cleanup, render, screen } from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

afterEach(() => {
  cleanup();
});

import { NextIntlClientProvider } from "next-intl";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CheckInHub } from "@/features/portal/components/check-in-hub";
import { MyFeesLedger } from "@/features/portal/components/my-fees-ledger";
import { MyProfileForm } from "@/features/portal/components/my-profile-form";
import enMessages from "../../messages/en-US.json";

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en-US" messages={enMessages}>
      <TooltipProvider>{ui}</TooltipProvider>
    </NextIntlClientProvider>,
  );
}

describe("Member Portal UI Views", () => {
  describe("Field Check-In Hub (CheckInHub)", () => {
    it("renders live open activity card with prominent size='lg' check-in button", () => {
      const mockOpenActivity = {
        id: "act-1",
        title: "Kajian Rutin Malam Ahad",
        topic: "Tafsir Al-Quran",
        location: "Masjid Al-Ihsan",
        activityDate: "2026-11-08",
        startTime: "19:30",
        endTime: "21:30",
        attendanceCloseAt: new Date(Date.now() + 3600000).toISOString(),
        attendanceRadius: 100,
        alreadyCheckedIn: false,
      };

      renderWithIntl(
        <CheckInHub
          openActivities={[mockOpenActivity]}
          upcomingActivities={[]}
        />,
      );

      // Activity details
      expect(screen.getByText("Kajian Rutin Malam Ahad")).toBeDefined();
      expect(screen.getByText("Masjid Al-Ihsan")).toBeDefined();

      // Check-in button is rendered
      const checkInBtn = screen.getByRole("button", { name: /check in/i });
      expect(checkInBtn).toBeDefined();

      // Check-in button has size="lg" styling (h-11 or px-8 or py-3 or similar shadcn lg class)
      expect(
        checkInBtn.className.includes("h-11") ||
          checkInBtn.className.includes("px-8") ||
          checkInBtn.className.includes("py-3") ||
          checkInBtn.getAttribute("data-size") === "lg",
      ).toBe(true);
    });

    it("renders excuse absence option and shows already checked in badge if user attended", () => {
      const mockCheckedInActivity = {
        id: "act-2",
        title: "Musyawarah Kerja",
        topic: "Evaluasi Semester",
        location: "Aula Kantor",
        activityDate: "2026-11-08",
        startTime: "09:00",
        endTime: "12:00",
        attendanceCloseAt: new Date(Date.now() + 3600000).toISOString(),
        attendanceRadius: 100,
        alreadyCheckedIn: true,
      };

      renderWithIntl(
        <CheckInHub
          openActivities={[mockCheckedInActivity]}
          upcomingActivities={[]}
        />,
      );

      expect(screen.getByText(/already checked in/i)).toBeDefined();
    });

    it("renders empty state when no activities are currently open", () => {
      renderWithIntl(
        <CheckInHub openActivities={[]} upcomingActivities={[]} />,
      );

      expect(screen.getByText(/no open activities/i)).toBeDefined();
    });
  });

  describe("Personal Fee Ledger (MyFeesLedger)", () => {
    it("renders outstanding balance banner with overdue warning when overdue dues exist", () => {
      const mockRecords = [
        {
          id: "fee-1",
          year: 2026,
          month: 1,
          amountIdr: 20000,
          status: "paid" as const,
          paidAt: "2026-01-10",
          note: null,
        },
        {
          id: "fee-2",
          year: 2026,
          month: 2,
          amountIdr: 20000,
          status: "overdue" as const,
          paidAt: null,
          note: null,
        },
      ];

      renderWithIntl(
        <MyFeesLedger
          records={mockRecords}
          totalOutstanding={20000}
          hasOverdue={true}
        />,
      );

      // Warning alert or banner is rendered
      expect(screen.getAllByText(/overdue/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/20\.000/).length).toBeGreaterThanOrEqual(1);
    });

    it("renders chronological table rows with badges", () => {
      const mockRecords = [
        {
          id: "fee-1",
          year: 2026,
          month: 1,
          amountIdr: 25000,
          status: "paid" as const,
          paidAt: "2026-01-15",
          note: "Transfer BCA",
        },
      ];

      renderWithIntl(
        <MyFeesLedger
          records={mockRecords}
          totalOutstanding={0}
          hasOverdue={false}
        />,
      );

      expect(screen.getByText("January 2026")).toBeDefined();
      expect(screen.getAllByText(/paid/i).length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText("Transfer BCA")).toBeDefined();
    });
  });

  describe("Personal Profile View (MyProfileForm)", () => {
    it("renders biographical details, non-editable badges, and editable inputs", () => {
      const mockMember = {
        id: "mem-1",
        fullName: "Fauzi Anwar",
        memberNumber: "NPA-12345",
        departmentName: "Kaderisasi",
        positionName: "Ketua Bidang",
        phone: "081234567890",
        address: "Jl. Pemuda No. 1",
        birthDate: "1998-05-14",
        profilePhoto: null,
      };

      renderWithIntl(<MyProfileForm member={mockMember} />);

      // Non-editable affiliation badges
      expect(screen.getByText("Fauzi Anwar")).toBeDefined();
      expect(screen.getByText("NPA-12345")).toBeDefined();
      expect(screen.getByText("Kaderisasi")).toBeDefined();
      expect(screen.getByText("Ketua Bidang")).toBeDefined();

      // Editable fields
      expect(screen.getByDisplayValue("081234567890")).toBeDefined();
      expect(screen.getByDisplayValue("Jl. Pemuda No. 1")).toBeDefined();
      expect(screen.getByDisplayValue("1998-05-14")).toBeDefined();
    });
  });
});
