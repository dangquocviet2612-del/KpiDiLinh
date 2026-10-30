// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

const unavailableMessage = "Không thể đăng nhập lúc này. Vui lòng kiểm tra kết nối và thử lại.";
const denied = () => ({ ok: false, error: "CredentialsSignin", code: undefined, status: 401, url: null });
const granted = () => ({ ok: true, error: undefined, code: undefined, status: 200, url: "/" });

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function fillForm(username = "synthetic-user", password = "demo-pass") {
  const usernameInput = screen.getByLabelText("Tài khoản");
  const passwordInput = screen.getByLabelText("Mật khẩu");
  fireEvent.change(usernameInput, { target: { value: username } });
  fireEvent.change(passwordInput, { target: { value: password } });
  const form = usernameInput.closest("form");
  if (!form) throw new Error("Missing login form");
  const button = form.querySelector('button[type="submit"]');
  if (!button) throw new Error("Missing submit button");
  return { form, button, usernameInput, passwordInput };
}

beforeEach(() => {
  mocks.signIn.mockReset().mockResolvedValue(denied());
  mocks.push.mockReset(); mocks.refresh.mockReset();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("login feedback and request ownership", () => {
  it("retains labels/password masking and exposes autocomplete and initial busy state", () => {
    render(<LoginPage />);
    const { form, usernameInput, passwordInput } = fillForm();
    expect(screen.getByRole("heading", { name: "Đăng Nhập" })).toBeInTheDocument();
    expect(usernameInput).toHaveAttribute("autocomplete", "username");
    expect(passwordInput).toHaveAttribute("autocomplete", "current-password");
    expect(passwordInput).toHaveAttribute("type", "password");
    expect(form).toHaveAttribute("aria-busy", "false");
  });

  it("disables both fields and submit while authentication is pending", async () => {
    const pending = deferred<ReturnType<typeof denied>>(); mocks.signIn.mockReturnValue(pending.promise);
    render(<LoginPage />); const { form, button, usernameInput, passwordInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    try {
      expect(button).toBeDisabled(); expect(usernameInput).toBeDisabled(); expect(passwordInput).toBeDisabled();
      expect(form).toHaveAttribute("aria-busy", "true"); expect(mocks.push).not.toHaveBeenCalled();
    } finally { await act(async () => { pending.resolve(denied()); }); }
  });

  it("coalesces rapid form submits into one in-flight signIn call", async () => {
    const pending = deferred<ReturnType<typeof denied>>(); mocks.signIn.mockReturnValue(pending.promise);
    render(<LoginPage />); const { form } = fillForm();
    await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
    try { expect(mocks.signIn).toHaveBeenCalledOnce(); }
    finally { await act(async () => { pending.resolve(denied()); }); }
  });

  it("keeps credential-error copy, announces it, and enables retry", async () => {
    render(<LoginPage />); const { form, button, usernameInput, passwordInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByText("Sai tài khoản hoặc mật khẩu")).toHaveAttribute("role", "alert");
    expect(form).toHaveAttribute("aria-describedby", "login-error"); expect(button).toBeEnabled();
    expect(usernameInput).toHaveValue("synthetic-user"); expect(passwordInput).toHaveValue("demo-pass");
    expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it.each([new Error("private-detail"), "private-detail"])("recovers from rejected signIn without leaking exception details: %s", async (failure) => {
    mocks.signIn.mockRejectedValue(failure);
    render(<LoginPage />); const { form, button, usernameInput, passwordInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(button).toBeEnabled(); expect(usernameInput).toBeEnabled(); expect(passwordInput).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent(unavailableMessage);
    expect(screen.queryByText("private-detail")).not.toBeInTheDocument();
    expect(form).toHaveAttribute("aria-busy", "false"); expect(mocks.push).not.toHaveBeenCalled();
  });

  it.each([undefined, { ...granted(), ok: false }, { ...granted(), ok: false, status: 503 }])("does not navigate on an unconfirmed response: %j", async (response) => {
    mocks.signIn.mockResolvedValue(response);
    render(<LoginPage />); const { form, button } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(mocks.push).not.toHaveBeenCalled(); expect(mocks.refresh).not.toHaveBeenCalled();
    expect(button).toBeEnabled(); expect(screen.getByRole("alert")).toHaveTextContent(unavailableMessage);
  });

  it("navigates only after verified success and keeps the form locked until navigation", async () => {
    mocks.signIn.mockResolvedValue(granted());
    render(<LoginPage />); const { form, button } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/"); expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(button).toBeDisabled(); expect(form).toHaveAttribute("aria-busy", "true");
    await act(async () => { fireEvent.submit(form); });
    expect(mocks.signIn).toHaveBeenCalledOnce(); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("gives a response error precedence over ok=true", async () => {
    mocks.signIn.mockResolvedValue({ ...granted(), error: "CredentialsSignin" });
    render(<LoginPage />); const { form, button } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(mocks.push).not.toHaveBeenCalled(); expect(button).toBeEnabled();
    expect(screen.getByRole("alert")).toHaveTextContent("Sai tài khoản hoặc mật khẩu");
  });

  it("clears the previous error for a retry and retains entered credentials", async () => {
    render(<LoginPage />); const { form, usernameInput, passwordInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByText("Sai tài khoản hoặc mật khẩu")).toBeInTheDocument();
    const pending = deferred<ReturnType<typeof denied>>(); mocks.signIn.mockReturnValue(pending.promise);
    await act(async () => { fireEvent.submit(form); });
    try {
      expect(mocks.signIn).toHaveBeenCalledTimes(2); expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(form).not.toHaveAttribute("aria-describedby"); expect(form).toHaveAttribute("aria-busy", "true");
      expect(usernameInput).toHaveValue("synthetic-user"); expect(passwordInput).toHaveValue("demo-pass");
    } finally { await act(async () => { pending.resolve(denied()); }); }
  });

  it("passes credential values verbatim and preserves redirect=false", async () => {
    render(<LoginPage />); const { form } = fillForm(" synthetic-user ", " demo-pass ");
    await act(async () => { fireEvent.submit(form); });
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith("credentials", { username: " synthetic-user ", password: " demo-pass ", redirect: false });
  });

  it("unlocks and sanitizes feedback if synchronous navigation fails", async () => {
    mocks.signIn.mockResolvedValue(granted()); mocks.push.mockImplementation(() => { throw new Error("private-navigation-detail"); });
    render(<LoginPage />); const { form, button } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(button).toBeEnabled(); expect(screen.getByRole("alert")).toHaveTextContent(unavailableMessage);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
