// @vitest-environment jsdom
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { it, expect, vi } from "vitest";
import InstallAppButton from "@/components/InstallAppButton";

it("shows installation guidance when native installation is unavailable", async () => {
  render(<InstallAppButton />);
  await userEvent.click(screen.getByRole("button", { name: "Cài ứng dụng" }));
  expect(screen.getByRole("dialog", { name: "Cài ứng dụng" })).toBeVisible();
  expect(screen.getByText(/iPhone\/iPad/)).toBeVisible();
  await userEvent.keyboard("{Escape}");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("prompts only on click and does not claim installation after dismissal", async () => {
  render(<InstallAppButton />);
  const event = new Event("beforeinstallprompt", { cancelable: true });
  const prompt = vi.fn().mockResolvedValue(undefined);
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome: "dismissed" }) });
  fireEvent(window, event);
  expect(prompt).not.toHaveBeenCalled();
  await userEvent.click(screen.getByRole("button", { name: "Cài ứng dụng" }));
  await waitFor(() => expect(prompt).toHaveBeenCalledTimes(1));
  expect(screen.getByRole("button", { name: "Cài ứng dụng" })).toBeEnabled();
  fireEvent(window, new Event("appinstalled"));
  expect(screen.getByRole("button", { name: "Đã cài ứng dụng" })).toBeDisabled();
});
