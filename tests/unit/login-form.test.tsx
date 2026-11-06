// @vitest-environment happy-dom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import type React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

import { NextIntlClientProvider } from "next-intl";
import { LoginForm } from "@/features/auth/components/login-form";
import enMessages from "../../messages/en-US.json";

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => "/login",
}));

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en-US" messages={enMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("Sign-In Form Component", () => {
  it("renders email/NPA and password fields with sign-in button", () => {
    renderWithIntl(<LoginForm />);

    expect(screen.getByLabelText(/Email or NPA/i)).toBeDefined();
    expect(screen.getByLabelText(/Password/i)).toBeDefined();
    expect(screen.getByRole("button", { name: /Sign In/i })).toBeDefined();
  });

  it("shows validation error when submitting empty fields", async () => {
    renderWithIntl(<LoginForm />);

    const submitBtn = screen.getByRole("button", { name: /Sign In/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Identifier is required/i)).toBeDefined();
      expect(
        screen.getByText(/Password must be at least 8 characters/i),
      ).toBeDefined();
    });
  });

  it("calls authClient.signIn.email when identifier is an email", async () => {
    const mockSignInEmail = vi.fn().mockResolvedValue({
      data: { user: { id: "1" } },
      error: null,
    });

    renderWithIntl(<LoginForm onSignInEmail={mockSignInEmail} />);

    const idInput = screen.getByLabelText(/Email or NPA/i);
    const passInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole("button", { name: /Sign In/i });

    fireEvent.change(idInput, { target: { value: "user@pemuda.local" } });
    fireEvent.change(passInput, { target: { value: "password123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSignInEmail).toHaveBeenCalledWith({
        email: "user@pemuda.local",
        password: "password123",
      });
    });
  });

  it("calls authClient.signIn.username when identifier is an alphanumeric NPA string", async () => {
    const mockSignInUsername = vi.fn().mockResolvedValue({
      data: { user: { id: "2" } },
      error: null,
    });

    renderWithIntl(<LoginForm onSignInUsername={mockSignInUsername} />);

    const idInput = screen.getByLabelText(/Email or NPA/i);
    const passInput = screen.getByLabelText(/Password/i);
    const submitBtn = screen.getByRole("button", { name: /Sign In/i });

    fireEvent.change(idInput, { target: { value: "NPA-12345" } });
    fireEvent.change(passInput, { target: { value: "password123" } });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockSignInUsername).toHaveBeenCalledWith({
        username: "NPA-12345",
        password: "password123",
      });
    });
  });
});
