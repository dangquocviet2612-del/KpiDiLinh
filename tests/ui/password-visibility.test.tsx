// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LoginPage from "@/app/login/page";
import ChangePasswordPage from "@/app/(dashboard)/change-password/page";

const mocks = vi.hoisted(() => ({ signIn: vi.fn(), push: vi.fn(), refresh: vi.fn(), fetch: vi.fn() }));
vi.mock("next-auth/react", () => ({ signIn: mocks.signIn }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));

const denied = () => ({ ok: false, error: "CredentialsSignin", status: 401 });
const granted = () => ({ ok: true, error: undefined, status: 200 });
const successResponse = () => new Response(JSON.stringify({ message: "Đổi mật khẩu thành công" }), { status: 200 });
const wrongPasswordResponse = () => new Response(JSON.stringify({ error: "Mật khẩu hiện tại không đúng" }), { status: 400 });
const changeFields = [
  { label: /^Mật khẩu hiện tại/, visibilityLabel: "mật khẩu hiện tại", id: "current-password", name: "currentPassword", autocomplete: "current-password" },
  { label: /^Mật khẩu mới/, visibilityLabel: "mật khẩu mới", id: "new-password", name: "newPassword", autocomplete: "new-password" },
  { label: /^Xác nhận mật khẩu mới/, visibilityLabel: "xác nhận mật khẩu mới", id: "confirm-password", name: "confirmPassword", autocomplete: "new-password" },
];

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function formOf(input: HTMLElement) {
  const form = input.closest("form");
  if (!form) throw new Error("Missing form");
  return form;
}

function fillLogin(username = "synthetic-user", password = "demo-pass") {
  fireEvent.change(screen.getByLabelText("Tài khoản"), { target: { value: username } });
  const input = screen.getByLabelText<HTMLInputElement>("Mật khẩu");
  fireEvent.change(input, { target: { value: password } });
  return { input, form: formOf(input) };
}

function fillChange(current = "demo-old", next = "demo-new", confirmation = next) {
  const inputs = changeFields.map(({ label }) => screen.getByLabelText<HTMLInputElement>(label));
  for (const [index, value] of [current, next, confirmation].entries()) fireEvent.change(inputs[index], { target: { value } });
  return { inputs, form: formOf(inputs[0]) };
}

function showAllChangeFields() {
  for (const field of changeFields) fireEvent.click(screen.getByRole("button", { name: `Hiện ${field.visibilityLabel}` }));
}

beforeEach(() => {
  mocks.signIn.mockReset().mockResolvedValue(denied());
  mocks.push.mockReset(); mocks.refresh.mockReset();
  mocks.fetch.mockReset().mockImplementation(async () => successResponse());
  vi.stubGlobal("fetch", mocks.fetch);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("login password visibility", () => {
  it("starts masked and exposes a distinct non-submit control for the existing field", () => {
    render(<LoginPage />); const { input } = fillLogin();
    const toggle = screen.getByRole("button", { name: "Hiện mật khẩu" });
    expect(input).toHaveAttribute("type", "password"); expect(input).toHaveAttribute("autocomplete", "current-password");
    expect(input).toBeRequired(); expect(input).toHaveAttribute("id", "password");
    expect(toggle).toHaveAttribute("type", "button"); expect(toggle).toHaveAttribute("aria-controls", input.id);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
  });

  it("reveals and hides without changing values or authenticating", () => {
    render(<LoginPage />); const { input } = fillLogin(" demo-user ", " demo-pass ");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    expect(input).toHaveAttribute("type", "text"); expect(input).toHaveValue(" demo-pass ");
    const toggle = screen.getByRole("button", { name: "Ẩn mật khẩu" });
    expect(toggle).toHaveAttribute("aria-pressed", "true"); fireEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password"); expect(input).toHaveValue(" demo-pass ");
    expect(mocks.signIn).not.toHaveBeenCalled(); expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("supports native keyboard focus and Space/Enter without submitting", async () => {
    const user = userEvent.setup(); render(<LoginPage />); const { input } = fillLogin();
    await user.tab(); expect(screen.getByLabelText("Tài khoản")).toHaveFocus();
    await user.tab(); expect(input).toHaveFocus(); await user.tab();
    const toggle = screen.getByRole("button", { name: "Hiện mật khẩu" }); expect(toggle).toHaveFocus();
    await user.keyboard(" "); expect(input).toHaveAttribute("type", "text"); expect(toggle).toHaveFocus();
    await user.keyboard("{Enter}"); expect(input).toHaveAttribute("type", "password"); expect(toggle).toHaveFocus();
    expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("remasks and disables the control while signing in, retaining masking after failure", async () => {
    const gate = deferred<ReturnType<typeof denied>>(); mocks.signIn.mockReturnValue(gate.promise);
    render(<LoginPage />); const { input, form } = fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    await act(async () => { fireEvent.submit(form); });
    try {
      expect(input).toHaveAttribute("type", "password"); expect(input).toBeDisabled();
      const toggle = screen.getByRole("button", { name: "Hiện mật khẩu" }); expect(toggle).toBeDisabled();
      fireEvent.click(toggle); expect(input).toHaveAttribute("type", "password");
    } finally { await act(async () => { gate.resolve(denied()); }); }
    expect(input).toBeEnabled(); expect(input).toHaveValue("demo-pass"); expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Hiện mật khẩu" })).toBeEnabled();
  });

  it("guards an already-rendered toggle during the submit batch", async () => {
    const gate = deferred<ReturnType<typeof denied>>(); mocks.signIn.mockReturnValue(gate.promise);
    render(<LoginPage />); const { input, form } = fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    const toggle = screen.getByRole("button", { name: "Ẩn mật khẩu" });
    await act(async () => { fireEvent.submit(form); fireEvent.click(toggle); fireEvent.submit(form); });
    try { expect(input).toHaveAttribute("type", "password"); expect(mocks.signIn).toHaveBeenCalledOnce(); }
    finally { await act(async () => { gate.resolve(denied()); }); }
  });

  it("retains entered values but not revealed state after a rejected signIn", async () => {
    mocks.signIn.mockRejectedValue(new Error("synthetic-private-failure"));
    render(<LoginPage />); const { input, form } = fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    await act(async () => { fireEvent.submit(form); });
    expect(input).toHaveAttribute("type", "password"); expect(input).toHaveValue("demo-pass");
    expect(screen.getByRole("button", { name: "Hiện mật khẩu" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });

  it("keeps successful navigation locked and passes visible credentials verbatim", async () => {
    mocks.signIn.mockResolvedValue(granted()); render(<LoginPage />);
    const { input, form } = fillLogin(" demo-user ", " demo-pass ");
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    await act(async () => { fireEvent.submit(form); });
    expect(mocks.signIn).toHaveBeenCalledExactlyOnceWith("credentials", { username: " demo-user ", password: " demo-pass ", redirect: false });
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/"); expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(input).toHaveAttribute("type", "password"); expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hiện mật khẩu" })).toBeDisabled();
  });

  it("does not retain visibility across a page remount", () => {
    const view = render(<LoginPage />); fillLogin();
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu" }));
    view.unmount(); render(<LoginPage />);
    expect(screen.getByLabelText("Mật khẩu")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "Hiện mật khẩu" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("change-password visibility", () => {
  it.each(changeFields)("keeps $name attributes and its own initially masked control", ({ label, id, name, autocomplete, visibilityLabel }) => {
    render(<ChangePasswordPage />); const input = screen.getByLabelText(label);
    expect(input).toHaveAttribute("id", id); expect(input).toHaveAttribute("name", name); expect(input).toBeRequired();
    expect(input).toHaveAttribute("autocomplete", autocomplete); expect(input).toHaveAttribute("type", "password");
    if (name !== "currentPassword") expect(input).toHaveAttribute("minlength", "6");
    const toggle = screen.getByRole("button", { name: `Hiện ${visibilityLabel}` });
    expect(toggle).toHaveAttribute("aria-controls", id); expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveAttribute("type", "button"); expect(formOf(input)).toHaveAttribute("method", "post");
  });

  it.each(changeFields)("only reveals $name, without changing any field or invoking the API", ({ label, visibilityLabel }) => {
    render(<ChangePasswordPage />); const { inputs } = fillChange(); const selected = screen.getByLabelText(label);
    const originalValues = inputs.map((input) => input.value);
    fireEvent.click(screen.getByRole("button", { name: `Hiện ${visibilityLabel}` }));
    for (const input of inputs) expect(input).toHaveAttribute("type", input === selected ? "text" : "password");
    expect(inputs.map((input) => input.value)).toEqual(originalValues);
    fireEvent.click(screen.getByRole("button", { name: `Ẩn ${visibilityLabel}` }));
    for (const input of inputs) expect(input).toHaveAttribute("type", "password");
    expect(mocks.fetch).not.toHaveBeenCalled(); expect(mocks.signIn).not.toHaveBeenCalled();
  });

  it("remasks and locks all controls during PUT, retaining values after known failure", async () => {
    const gate = deferred<void>(); mocks.fetch.mockImplementation(() => gate.promise.then(wrongPasswordResponse));
    render(<ChangePasswordPage />); const { inputs, form } = fillChange(); showAllChangeFields();
    await act(async () => { fireEvent.submit(form); });
    try {
      for (const input of inputs) { expect(input).toHaveAttribute("type", "password"); expect(input).toBeDisabled(); }
      for (const field of changeFields) expect(screen.getByRole("button", { name: `Hiện ${field.visibilityLabel}` })).toBeDisabled();
    } finally { await act(async () => { gate.resolve(); }); }
    expect(inputs.map((input) => input.value)).toEqual(["demo-old", "demo-new", "demo-new"]);
    for (const input of inputs) { expect(input).toHaveAttribute("type", "password"); expect(input).toBeEnabled(); }
    expect(screen.getByRole("alert")).toHaveTextContent("Mật khẩu hiện tại không đúng");
  });

  it("rejects queued reveal attempts once the submission ref owns the request", async () => {
    const gate = deferred<void>(); mocks.fetch.mockImplementation(() => gate.promise.then(wrongPasswordResponse));
    render(<ChangePasswordPage />); const { inputs, form } = fillChange(); showAllChangeFields();
    const toggles = changeFields.map((field) => screen.getByRole("button", { name: `Ẩn ${field.visibilityLabel}` }));
    await act(async () => { fireEvent.submit(form); for (const toggle of toggles) fireEvent.click(toggle); fireEvent.submit(form); });
    try { for (const input of inputs) expect(input).toHaveAttribute("type", "password"); expect(mocks.fetch).toHaveBeenCalledOnce(); }
    finally { await act(async () => { gate.resolve(); }); }
  });

  it.each([
    { next: "short", confirm: "short", error: "Mật khẩu mới phải có ít nhất 6 ký tự" },
    { next: "demo-new", confirm: "different", error: "Xác nhận mật khẩu không khớp" },
  ])("remasks after existing local validation failure: $error", async ({ next, confirm, error }) => {
    render(<ChangePasswordPage />); const { inputs, form } = fillChange("demo-old", next, confirm); showAllChangeFields();
    await act(async () => { fireEvent.submit(form); });
    for (const input of inputs) { expect(input).toHaveAttribute("type", "password"); expect(input).toBeEnabled(); }
    expect(screen.getByRole("alert")).toHaveTextContent(error); expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("clears confirmed-success fields, keeps them masked, and retains the exact PUT contract", async () => {
    render(<ChangePasswordPage />); const { inputs, form } = fillChange(" demo-old ", " demo-new "); showAllChangeFields();
    await act(async () => { fireEvent.submit(form); });
    expect(mocks.fetch).toHaveBeenCalledExactlyOnceWith("/api/change-password", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: " demo-old ", newPassword: " demo-new " }),
    });
    for (const input of inputs) { expect(input).toHaveValue(""); expect(input).toHaveAttribute("type", "password"); }
    expect(screen.getByRole("status")).toHaveTextContent("Đổi mật khẩu thành công!");
  });

  it("keeps an uncertain response masked without clearing entered values", async () => {
    mocks.fetch.mockRejectedValue(new Error("synthetic-network-failure"));
    render(<ChangePasswordPage />); const { inputs, form } = fillChange(); showAllChangeFields();
    await act(async () => { fireEvent.submit(form); });
    expect(inputs.map((input) => input.value)).toEqual(["demo-old", "demo-new", "demo-new"]);
    for (const input of inputs) expect(input).toHaveAttribute("type", "password");
    expect(screen.getByRole("alert")).toHaveTextContent("Không thể xác nhận kết quả đổi mật khẩu");
  });

  it("does not clear an existing validation message just by toggling visibility", async () => {
    render(<ChangePasswordPage />); const { form } = fillChange("demo-old", "short");
    await act(async () => { fireEvent.submit(form); });
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu mới" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Mật khẩu mới phải có ít nhất 6 ký tự");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("keeps onChange/name wiring when editing a revealed field", () => {
    render(<ChangePasswordPage />); const { inputs } = fillChange();
    fireEvent.click(screen.getByRole("button", { name: "Hiện mật khẩu mới" }));
    fireEvent.change(inputs[1], { target: { value: " edited-demo " } });
    fireEvent.click(screen.getByRole("button", { name: "Ẩn mật khẩu mới" }));
    expect(inputs[1]).toHaveValue(" edited-demo "); expect(inputs[0]).toHaveValue("demo-old"); expect(inputs[2]).toHaveValue("demo-new");
  });
});
