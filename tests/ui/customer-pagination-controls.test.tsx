// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PaginationControls from "@/components/PaginationControls";
import { customerPaginationProps, paginationVariants, type PaginationVariant } from "../fixtures/customer-pagination-controls";

afterEach(cleanup);
const directionPattern = (direction: "Trước" | "Sau") => new RegExp(`^(Trang )?${direction}$`, "i");
function setup(variant: PaginationVariant = "middle", form = false) {
  const props = customerPaginationProps(variant); const onPageChange = vi.fn(); const onLimitChange = vi.fn(); const submit = vi.fn();
  const pagination = <PaginationControls {...props} onPageChange={onPageChange} onLimitChange={onLimitChange} />;
  const view = render(form ? <form onSubmit={(event) => { event.preventDefault(); submit(); }}>{pagination}</form> : pagination);
  return { ...view, props, onPageChange, onLimitChange, submit };
}

describe("customer pagination controls", () => {
  it("names the landmark, limit selector and page actions explicitly", () => {
    setup(); const nav = screen.getByRole("navigation", { name: "Phân trang khách hàng" });
    expect(within(nav).getByRole("combobox", { name: "Số khách hàng mỗi trang" })).toHaveAttribute("title", "Số lượng hiển thị");
    expect(within(nav).getByRole("button", { name: "Trang trước" })).toHaveTextContent("Trước");
    expect(within(nav).getByRole("button", { name: "Trang sau" })).toHaveTextContent("Sau");
  });

  it.each(["Trước", "Sau"] as const)("does not submit a surrounding form when clicking %s", async (direction) => {
    const user = userEvent.setup(); const { props, onPageChange, submit } = setup("middle", true);
    const button = screen.getByRole("button", { name: directionPattern(direction) });
    await user.click(button);
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(props.page + (direction === "Trước" ? -1 : 1));
    expect(submit).not.toHaveBeenCalled(); expect(button).toHaveAttribute("type", "button");
  });

  it.each(["{Enter}", " "])("retains native keyboard activation without form submit: %s", async (key) => {
    const user = userEvent.setup(); const { props, onPageChange, submit } = setup("middle", true);
    await user.tab(); expect(screen.getByRole("combobox")).toHaveFocus();
    await user.tab(); expect(screen.getByRole("button", { name: directionPattern("Trước") })).toHaveFocus();
    await user.keyboard(key);
    expect(onPageChange).toHaveBeenCalledExactlyOnceWith(props.page - 1); expect(submit).not.toHaveBeenCalled();
  });

  it.each(paginationVariants)("preserves boundary disablement and numeric destinations: %s", async (variant) => {
    const user = userEvent.setup(); const { props, onPageChange, onLimitChange } = setup(variant);
    const previous = screen.getByRole("button", { name: directionPattern("Trước") }); const next = screen.getByRole("button", { name: directionPattern("Sau") });
    expect(previous).toHaveProperty("disabled", props.page === 1); expect(next).toHaveProperty("disabled", props.page === props.totalPages);
    await user.click(previous); await user.click(next);
    const expected = [...(props.page === 1 ? [] : [props.page - 1]), ...(props.page === props.totalPages ? [] : [props.page + 1])];
    expect(onPageChange.mock.calls.map(([target]) => target)).toEqual(expected); expect(onLimitChange).not.toHaveBeenCalled();
  });

  it.each([10, 20, 50, 100])("forwards selected limit %s as one number without changing page itself", async (limit) => {
    const user = userEvent.setup(); const props = customerPaginationProps(); const onLimitChange = vi.fn(); const onPageChange = vi.fn();
    render(<PaginationControls {...props} limit={limit === 10 ? 20 : 10} onLimitChange={onLimitChange} onPageChange={onPageChange} />);
    await user.selectOptions(screen.getByRole("combobox"), String(limit));
    expect(onLimitChange).toHaveBeenCalledExactlyOnceWith(limit); expect(onPageChange).not.toHaveBeenCalled();
  });

  it("retains information text, option order and no premature live completion announcement", () => {
    setup();
    expect(screen.getByText("Hiển thị trang 3 / 5 (Tổng 95 khách hàng)")).toBeInTheDocument();
    expect(screen.getAllByRole("option").map((option) => [option.getAttribute("value"), option.textContent])).toEqual([["10", "10 / trang"], ["20", "20 / trang"], ["50", "50 / trang"], ["100", "100 / trang"]]);
    expect(screen.getByRole("combobox")).toHaveValue("20");
    expect(document.querySelector("[aria-live], [role=status]")).toBeNull();
  });

  it("updates only from controlled page/limit props without implicit requests", async () => {
    const user = userEvent.setup(); const { props, rerender, onPageChange, onLimitChange } = setup();
    await user.selectOptions(screen.getByRole("combobox"), "100");
    expect(onLimitChange).toHaveBeenCalledExactlyOnceWith(100); expect(onPageChange).not.toHaveBeenCalled();
    expect(screen.getByText("Hiển thị trang 3 / 5 (Tổng 95 khách hàng)")).toBeInTheDocument();
    rerender(<PaginationControls {...props} page={1} totalPages={1} limit={100} onLimitChange={onLimitChange} onPageChange={onPageChange} />);
    expect(screen.getByRole("combobox")).toHaveValue("100");
    expect(screen.getByText("Hiển thị trang 1 / 1 (Tổng 95 khách hàng)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: directionPattern("Trước") })).toBeDisabled(); expect(screen.getByRole("button", { name: directionPattern("Sau") })).toBeDisabled();
    expect(onLimitChange).toHaveBeenCalledTimes(1);
  });

  it.each(["first", "last", "single"] as const)("skips disabled page buttons in Tab order: %s", async (variant) => {
    const user = userEvent.setup(); setup(variant); await user.tab(); expect(screen.getByRole("combobox")).toHaveFocus();
    await user.tab();
    if (variant === "single") expect(document.body).toHaveFocus();
    else expect(screen.getByRole("button", { name: directionPattern(variant === "first" ? "Sau" : "Trước") })).toHaveFocus();
  });
});
