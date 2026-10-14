import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { AuthContext, AuthContextType } from "../context/auth-context";
import { LoginPage } from "../pages/LoginPage";
import { ResetPasswordPage, readRecoveryToken } from "../pages/ResetPasswordPage";
import { authApi } from "../api";
import { ApiError } from "../lib/api-error";
import i18n from "../i18n";
import { resetLocaleCache } from "../i18n/loader";
import { resetLanguageStore, selectLanguage } from "../i18n/language-store";

const authValue = (over: Partial<AuthContextType> = {}): AuthContextType => ({
  user: null,
  token: null,
  loading: false,
  notice: null,
  login: vi.fn(async () => ({ error: null })),
  logout: vi.fn(async () => {}),
  logoutEverywhere: vi.fn(async () => {}),
  ...over,
});

const LoginState: React.FC = () => {
  const location = useLocation();
  return <div data-testid="login-state">{JSON.stringify(location.state)}</div>;
};

beforeEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

describe("Login page: forgot password and notices", () => {
  const renderLogin = (value = authValue(), state?: unknown) =>
    render(
      <AuthContext.Provider value={value}>
        <MemoryRouter initialEntries={[{ pathname: "/login", state }]}>
          <LoginPage />
        </MemoryRouter>
      </AuthContext.Provider>
    );

  it("'Forgot password?' asks for the email and sends a real reset request (no alert)", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const forgot = vi
      .spyOn(authApi, "forgotPassword")
      .mockResolvedValue({ message: "If that email belongs..." });
    renderLogin();

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.getByRole("heading", { name: "Reset your password" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Email Address"), {
      target: { value: "admin@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(() => expect(forgot).toHaveBeenCalledWith("admin@example.com"));
    expect(await screen.findByText(/a reset link is on its way/i)).toBeInTheDocument();
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("shows a rate-limit refusal in the person's language", async () => {
    vi.spyOn(authApi, "forgotPassword").mockRejectedValue(
      new ApiError("Too many password reset attempts. Please try again after 15 minutes.", {
        status: 429,
      })
    );
    resetLocaleCache("hi");
    resetLanguageStore("en");
    await act(async () => {
      await selectLanguage("hi");
    });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "पासवर्ड भूल गए?" }));
    fireEvent.change(screen.getByLabelText("ईमेल पता"), { target: { value: "a@b.co" } });
    fireEvent.click(screen.getByRole("button", { name: "रीसेट लिंक भेजें" }));
    expect(await screen.findByText(/पासवर्ड रीसेट की बहुत ज़्यादा कोशिशें/)).toBeInTheDocument();
    resetLanguageStore("en");
    await act(async () => {
      await i18n.changeLanguage("en");
    });
  });

  it("explains that the session ended", () => {
    renderLogin(authValue({ notice: "session_ended" }));
    expect(screen.getByText("Your session has ended. Please sign in again.")).toBeInTheDocument();
  });

  it("confirms a changed password", () => {
    renderLogin(authValue(), { passwordChanged: true });
    expect(screen.getByText(/Your password has been changed/)).toBeInTheDocument();
  });
});

describe("Reset password page", () => {
  const renderReset = () =>
    render(
      <AuthContext.Provider value={authValue()}>
        <MemoryRouter initialEntries={["/reset-password"]}>
          <Routes>
            <Route path="/reset-password" element={<ResetPasswordPage />} />
            <Route path="/login" element={<LoginState />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    );

  it("reads only a recovery token from the URL fragment", () => {
    expect(readRecoveryToken("#access_token=abc&type=recovery&expires_in=3600")).toBe("abc");
    expect(readRecoveryToken("#access_token=abc&type=signup")).toBeNull();
    expect(readRecoveryToken("#error=access_denied&error_code=otp_expired")).toBeNull();
    expect(readRecoveryToken("")).toBeNull();
  });

  it("without a token it says the link is invalid and offers a new one", () => {
    renderReset();
    expect(screen.getByText(/This reset link is invalid or has expired/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Request a new link" })).toHaveAttribute(
      "href",
      "/login"
    );
  });

  it("checks length and confirmation, sets the password, removes the token from the URL and goes to sign-in", async () => {
    window.history.replaceState(null, "", "/reset-password#access_token=rec-tok&type=recovery");
    const reset = vi.spyOn(authApi, "resetPassword").mockResolvedValue({ message: "ok" });
    renderReset();
    await waitFor(() => expect(window.location.hash).toBe(""));

    const pw = screen.getByLabelText("New password");
    const confirm = screen.getByLabelText("Confirm new password");
    const save = screen.getByRole("button", { name: "Save new password" });

    fireEvent.change(pw, { target: { value: "short" } });
    fireEvent.change(confirm, { target: { value: "short" } });
    fireEvent.click(save);
    expect(screen.getByText("Use at least 10 characters.")).toBeInTheDocument();

    fireEvent.change(pw, { target: { value: "a-long-new-password" } });
    fireEvent.change(confirm, { target: { value: "a-long-new-passwordX" } });
    fireEvent.click(save);
    expect(screen.getByText("The two passwords do not match.")).toBeInTheDocument();
    expect(reset).not.toHaveBeenCalled();

    fireEvent.change(confirm, { target: { value: "a-long-new-password" } });
    fireEvent.click(save);
    await waitFor(() => expect(reset).toHaveBeenCalledWith("rec-tok", "a-long-new-password"));
    expect(await screen.findByTestId("login-state")).toHaveTextContent('{"passwordChanged":true}');
  });

  it("shows the server's refusal (expired link) translated", async () => {
    window.history.replaceState(null, "", "/reset-password#access_token=rec-tok&type=recovery");
    vi.spyOn(authApi, "resetPassword").mockRejectedValue(
      new ApiError("This reset link is invalid or has expired. Request a new one.", { status: 401 })
    );
    renderReset();
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "a-long-new-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "a-long-new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/);
  });
});
