// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ChangePasswordPage from "@/app/(dashboard)/change-password/page";

const fetchMock = vi.fn();
const successText = "Đổi mật khẩu thành công!";
const uncertainText = "Không thể xác nhận kết quả đổi mật khẩu. Hãy kiểm tra kết nối và thử đăng nhập lại trước khi gửi lại.";
const wrongCurrent = "Mật khẩu hiện tại không đúng";
const successPayload = { message: "Đổi mật khẩu thành công" };

function response(payload: unknown = successPayload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "Content-Type": "application/json" } });
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((finish) => { resolve = finish; });
  return { promise, resolve };
}

function fillForm(current = "demo-old", next = "demo-new", confirm = next) {
  const currentInput = screen.getByPlaceholderText("Nhập mật khẩu hiện tại");
  const newInput = screen.getByPlaceholderText("Tối thiểu 6 ký tự");
  const confirmInput = screen.getByPlaceholderText("Nhập lại mật khẩu mới");
  fireEvent.change(currentInput, { target: { value: current } });
  fireEvent.change(newInput, { target: { value: next } });
  fireEvent.change(confirmInput, { target: { value: confirm } });
  const form = currentInput.closest("form");
  if (!form) throw new Error("Missing password form");
  const button = form.querySelector('button[type="submit"]');
  if (!button) throw new Error("Missing submit button");
  return { form, button, currentInput, newInput, confirmInput };
}

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => response());
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("change-password request feedback", () => {
  it("associates all labels and autocomplete without exposing passwords in a native GET fallback", () => {
    render(<ChangePasswordPage />); const { form, currentInput, newInput, confirmInput } = fillForm();
    expect(screen.getByLabelText(/^Mật khẩu hiện tại/)).toBe(currentInput);
    expect(screen.getByLabelText(/^Mật khẩu mới/)).toBe(newInput);
    expect(screen.getByLabelText(/^Xác nhận mật khẩu mới/)).toBe(confirmInput);
    expect(currentInput).toHaveAttribute("autocomplete", "current-password");
    expect(newInput).toHaveAttribute("autocomplete", "new-password"); expect(confirmInput).toHaveAttribute("autocomplete", "new-password");
    for (const input of [currentInput, newInput, confirmInput]) expect(input).toHaveAttribute("type", "password");
    expect(form).toHaveAttribute("method", "post"); expect(form).toHaveAttribute("aria-busy", "false");
  });

  it("keeps the existing minimum length validation without calling the API", async () => {
    render(<ChangePasswordPage />); const { form, button } = fillForm("demo-old", "short");
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByText("Mật khẩu mới phải có ít nhất 6 ký tự")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled(); expect(button).toBeEnabled();
  });

  it("keeps confirmation validation and field values without calling the API", async () => {
    render(<ChangePasswordPage />); const { form, newInput, confirmInput } = fillForm("demo-old", "demo-new", "not-same");
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByText("Xác nhận mật khẩu không khớp")).toBeInTheDocument();
    expect(newInput).toHaveValue("demo-new"); expect(confirmInput).toHaveValue("not-same"); expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leave the guard locked after local validation fails", async () => {
    render(<ChangePasswordPage />); const { form, newInput, confirmInput } = fillForm("demo-old", "short");
    await act(async () => { fireEvent.submit(form); });
    fireEvent.change(newInput, { target: { value: "demo-new" } }); fireEvent.change(confirmInput, { target: { value: "demo-new" } });
    await act(async () => { fireEvent.submit(form); });
    expect(fetchMock).toHaveBeenCalledOnce(); expect(screen.getByText(successText)).toBeInTheDocument();
  });

  it("locks all fields and announces busy state during the request", async () => {
    const gate = deferred<void>(); fetchMock.mockImplementation(() => gate.promise.then(() => response()));
    render(<ChangePasswordPage />); const { form, button, currentInput, newInput, confirmInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    try {
      for (const input of [currentInput, newInput, confirmInput]) expect(input).toBeDisabled();
      expect(button).toBeDisabled(); expect(form).toHaveAttribute("aria-busy", "true");
      expect(button).toHaveAttribute("aria-label", "Đang đổi mật khẩu");
    } finally { await act(async () => { gate.resolve(); }); }
  });

  it("issues one PUT for rapid duplicate form submits", async () => {
    const gate = deferred<void>(); fetchMock.mockImplementation(() => gate.promise.then(() => response()));
    render(<ChangePasswordPage />); const { form } = fillForm();
    await act(async () => { fireEvent.submit(form); fireEvent.submit(form); });
    try { expect(fetchMock).toHaveBeenCalledOnce(); }
    finally { await act(async () => { gate.resolve(); }); }
  });

  it("does not accept input changes while the submitted password mutation is pending", async () => {
    const gate = deferred<void>(); fetchMock.mockImplementation(() => gate.promise.then(() => response()));
    render(<ChangePasswordPage />); const { form, newInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    try {
      fireEvent.change(newInput, { target: { value: "other-new" } });
      expect(newInput).toHaveValue("demo-new");
    } finally { await act(async () => { gate.resolve(); }); }
  });

  it("clears sensitive fields only after a confirmed successful response", async () => {
    render(<ChangePasswordPage />); const { form, button, currentInput, newInput, confirmInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    for (const input of [currentInput, newInput, confirmInput]) expect(input).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(successText); expect(button).toBeEnabled();
    expect(form).toHaveAttribute("aria-describedby", "change-password-message"); expect(form).toHaveAttribute("aria-busy", "false");
  });

  it("keeps a well-formed 4xx API error and entered values for correction", async () => {
    fetchMock.mockImplementation(async () => response({ error: wrongCurrent }, 400));
    render(<ChangePasswordPage />); const { form, button, currentInput, newInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByText(wrongCurrent)).toBeInTheDocument(); expect(currentInput).toHaveValue("demo-old"); expect(newInput).toHaveValue("demo-new");
    expect(screen.getByRole("alert")).toHaveTextContent(wrongCurrent); expect(button).toBeEnabled(); expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([new Error("private-detail"), "private-detail"])("sanitizes rejected fetch feedback without claiming the server did not mutate: %s", async (failure) => {
    fetchMock.mockRejectedValue(failure);
    render(<ChangePasswordPage />); const { form, button, newInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert")).toHaveTextContent(uncertainText); expect(screen.queryByText("private-detail")).not.toBeInTheDocument();
    expect(newInput).toHaveValue("demo-new"); expect(button).toBeEnabled(); expect(fetchMock).toHaveBeenCalledOnce();
  });

  it.each([200, 502])("handles non-JSON HTTP %i as an unconfirmed outcome without exposing raw content", async (status) => {
    fetchMock.mockImplementation(async () => new Response("<html>private-detail</html>", { status }));
    render(<ChangePasswordPage />); const { form, newInput, button } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert")).toHaveTextContent(uncertainText); expect(newInput).toHaveValue("demo-new"); expect(button).toBeEnabled();
    expect(screen.queryByText(successText)).not.toBeInTheDocument(); expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("does not expose a 5xx server detail", async () => {
    fetchMock.mockImplementation(async () => response({ error: "private-detail" }, 500));
    render(<ChangePasswordPage />); const { form } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert")).toHaveTextContent(uncertainText); expect(screen.queryByText("private-detail")).not.toBeInTheDocument();
  });

  it("does not render a non-string API error as an object", async () => {
    fetchMock.mockImplementation(async () => response({ error: { detail: "private-detail" } }, 400));
    render(<ChangePasswordPage />); const { form } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(screen.getByRole("alert")).toHaveTextContent(uncertainText); expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });

  it.each([null, {}, [], { message: 0 }, { message: " " }, { message: "OK", error: "private-detail" }].map((payload) => ({ payload })))("does not claim success or clear fields for malformed 2xx JSON: $payload", async ({ payload }) => {
    fetchMock.mockImplementation(async () => response(payload));
    render(<ChangePasswordPage />); const { form, newInput, currentInput, button } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(screen.queryByText(successText)).not.toBeInTheDocument();
    expect(newInput).toHaveValue("demo-new"); expect(currentInput).toHaveValue("demo-old");
    expect(screen.getByRole("alert")).toHaveTextContent(uncertainText); expect(button).toBeEnabled(); expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("clears old feedback on edit and releases the guard for a user-initiated retry", async () => {
    fetchMock.mockImplementationOnce(async () => response({ error: wrongCurrent }, 400));
    render(<ChangePasswordPage />); const { form, currentInput } = fillForm();
    await act(async () => { fireEvent.submit(form); }); expect(screen.getByText(wrongCurrent)).toBeInTheDocument();
    fireEvent.change(currentInput, { target: { value: "retry-old" } }); expect(screen.queryByText(wrongCurrent)).not.toBeInTheDocument();
    await act(async () => { fireEvent.submit(form); });
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(screen.getByRole("status")).toHaveTextContent(successText);
  });

  it.each([201, 202])("does not treat HTTP %i as the endpoint's confirmed HTTP 200 contract", async (status) => {
    fetchMock.mockImplementation(async () => response(successPayload, status));
    render(<ChangePasswordPage />); const { form, currentInput, newInput } = fillForm();
    await act(async () => { fireEvent.submit(form); });
    expect(screen.queryByText(successText)).not.toBeInTheDocument();
    expect(currentInput).toHaveValue("demo-old"); expect(newInput).toHaveValue("demo-new");
    expect(screen.getByRole("alert")).toHaveTextContent(uncertainText);
  });

  it("keeps PUT endpoint/body and password values verbatim without sending confirmation", async () => {
    render(<ChangePasswordPage />); const { form } = fillForm(" old-demo ", " new-demo ");
    await act(async () => { fireEvent.submit(form); });
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/change-password", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword: " old-demo ", newPassword: " new-demo " }) });
  });
});
