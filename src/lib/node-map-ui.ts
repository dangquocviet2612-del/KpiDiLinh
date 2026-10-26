export type NodeMapStatus = "RED" | "ORANGE" | "PURPLE" | "DEFAULT";

export function hasActiveNodeMapFilters(colorFilter: string, radiusFilter: number | null): boolean {
  return colorFilter !== "ALL" || radiusFilter !== null;
}

export function formatNodeMapCount(visible: number, total: number, hasActiveFilters: boolean): string {
  const visibleText = visible.toLocaleString("vi-VN");
  if (!hasActiveFilters) return `${visibleText} node trên bản đồ`;
  return `${visibleText}/${total.toLocaleString("vi-VN")} node trên bản đồ`;
}

export function getNodeStatusSymbol(status: string): string {
  switch (status) {
    case "RED":
      return "!";
    case "ORANGE":
      return "↓";
    case "PURPLE":
      return "~";
    default:
      return "✓";
  }
}

export function getNextMapSearchIndex(
  currentIndex: number,
  key: "ArrowDown" | "ArrowUp",
  itemCount: number,
): number {
  if (itemCount <= 0) return -1;
  if (key === "ArrowDown") return currentIndex >= itemCount - 1 ? 0 : currentIndex + 1;
  return currentIndex <= 0 ? itemCount - 1 : currentIndex - 1;
}
