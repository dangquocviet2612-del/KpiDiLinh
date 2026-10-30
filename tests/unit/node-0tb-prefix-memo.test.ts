import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Node0TbApiResponse, Node0TbItem } from "@/types";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  findNodes: vi.fn(),
  readiness: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRawUnsafe: mocks.query,
    $executeRawUnsafe: mocks.execute,
    $transaction: mocks.transaction,
    node: { findMany: mocks.findNodes },
  },
}));
vi.mock("@/lib/runtime-schema", () => ({ ensureRuntimeSchema: mocks.readiness }));

import { getNode0TbList, parseFlexibleDate } from "@/lib/node-0tb-db";
import { parseImportDate, toTrimmedString } from "@/lib/import-utils";

type DatabaseRow = {
  id: string;
  nodeCode: string;
  dateKd: string | null;
  dateKdRaw: string | null;
  dateKdFormatted: string | null;
  totalPort: number | null;
  usedPort: number | null;
  categoryKd: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type CoordinateRow = {
  name: string;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
};

type Filters = Parameters<typeof getNode0TbList>[0];

const sentinelName = "~PREFIX-OBSERVATION-SENTINEL~";
const sentinelDescription = "<observer-only> & unchanged";

function makeRows(entries: Array<string | Partial<DatabaseRow>>) {
  return Object.freeze(entries.map((entry, index): DatabaseRow => Object.freeze({
    id: `row-${index}`,
    nodeCode: "UNSET",
    dateKd: null,
    dateKdRaw: null,
    dateKdFormatted: null,
    totalPort: null,
    usedPort: null,
    categoryKd: null,
    note: null,
    createdAt: "2026-10-29T00:00:00.000Z",
    updatedAt: "2026-10-29T01:00:00.000Z",
    ...(typeof entry === "string" ? { nodeCode: entry } : entry),
  })));
}

function coordinate(name: string, latitude: number | null, description: string | null = name, longitude: number | null = latitude): CoordinateRow {
  return { name, latitude, longitude, description };
}

function makeNodes(entries: CoordinateRow[], withSentinel = true) {
  const nodes = withSentinel
    ? [...entries, coordinate(sentinelName, 901, sentinelDescription, 902)]
    : entries;
  return Object.freeze(nodes.map((node) => Object.freeze({ ...node })));
}

function useFixture(rows: readonly DatabaseRow[], nodes: readonly CoordinateRow[]) {
  mocks.query.mockResolvedValue(rows);
  mocks.findNodes.mockResolvedValue(nodes);
}

function expectReads(count = 1) {
  expect(mocks.readiness).toHaveBeenCalledTimes(count);
  expect(mocks.readiness).toHaveBeenCalledWith("node0tb");
  expect(mocks.query).toHaveBeenCalledTimes(count);
  expect(mocks.query).toHaveBeenCalledWith('SELECT * FROM "Node0Tb" ORDER BY "nodeCode" ASC');
  expect(mocks.findNodes).toHaveBeenCalledTimes(count);
  expect(mocks.findNodes).toHaveBeenCalledWith({
    select: { name: true, latitude: true, longitude: true, description: true },
  });
  for (let index = 0; index < count; index++) {
    expect(mocks.readiness.mock.invocationCallOrder[index]).toBeLessThan(mocks.query.mock.invocationCallOrder[index]);
    expect(mocks.query.mock.invocationCallOrder[index]).toBeLessThan(mocks.findNodes.mock.invocationCallOrder[index]);
  }
}

async function observeScans<Result>(operation: () => Promise<Result>, emptyNodeMap = false) {
  const originalEntries = Map.prototype.entries;
  const observedMaps = new Set<Map<unknown, unknown>>();
  const counts = { scans: 0, visits: 0 };
  const observer = vi.spyOn(Map.prototype, "entries").mockImplementation(function (this: Map<unknown, unknown>) {
    const sentinel = this.get(sentinelName) as Partial<CoordinateRow> | undefined;
    const hasSentinel = sentinel?.latitude === 901 && sentinel.longitude === 902 && sentinel.description === sentinelDescription;
    const emptyServiceMap = emptyNodeMap && this.size === 0 && Boolean(new Error().stack?.includes("node-0tb-db.ts"));
    const iterator = originalEntries.call(this);
    if (!hasSentinel && !emptyServiceMap && !observedMaps.has(this)) return iterator;
    observedMaps.add(this);
    counts.scans++;
    const originalNext = iterator.next.bind(iterator);
    iterator.next = () => {
      const result = originalNext();
      if (!result.done) counts.visits++;
      return result;
    };
    return iterator;
  });
  try {
    const result = await operation();
    return { result, counts, maps: observedMaps.size };
  } finally {
    observer.mockRestore();
  }
}

function legacyResponse(rows: readonly DatabaseRow[], nodes: readonly CoordinateRow[], filters?: Filters): Node0TbApiResponse {
  const lookup = new Map<string, CoordinateRow>();
  for (const node of nodes) {
    if (node.latitude !== null && node.longitude !== null) lookup.set(node.name.trim().toUpperCase(), node);
  }
  const allItems: Node0TbItem[] = rows.map((row) => {
    const normalizedCode = row.nodeCode.trim().toUpperCase();
    const normalizedBase = row.nodeCode.replace(/-SP\d+$/i, "").trim().toUpperCase();
    let selected = lookup.get(normalizedCode) ?? lookup.get(normalizedBase);
    if (!selected) {
      for (const [name, node] of lookup) {
        if (name.startsWith(normalizedBase) || normalizedBase.startsWith(name)) {
          selected = node;
          break;
        }
      }
    }
    return {
      id: row.id,
      nodeCode: row.nodeCode,
      dateKd: row.dateKd,
      dateKdFormatted: row.dateKdFormatted || row.dateKdRaw || "-",
      totalPort: row.totalPort,
      usedPort: row.usedPort ?? 0,
      categoryKd: row.categoryKd || "Chưa phân loại",
      note: row.note,
      latitude: selected?.latitude ?? null,
      longitude: selected?.longitude ?? null,
      nodeDescription: selected?.description ?? null,
      hasCoordinates: Boolean(selected),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
  const categories = [...new Set(allItems.map((item) => item.categoryKd!))];
  const withCoordinates = allItems.filter((item) => item.hasCoordinates).length;
  const categoryStats = categories.map((category) => {
    const matching = allItems.filter((item) => item.categoryKd === category);
    return { category, count: matching.length, withCoords: matching.filter((item) => item.hasCoordinates).length };
  });
  const filtered = allItems.filter((item) => {
    if (filters?.category && filters.category !== "ALL" && item.categoryKd!.toLowerCase() !== filters.category.toLowerCase()) return false;
    if (!filters?.search) return true;
    const needle = filters.search.trim().toLowerCase();
    return [item.nodeCode, item.categoryKd, item.nodeDescription].some((value) => value?.toLowerCase().includes(needle));
  });
  return {
    nodes: filtered,
    stats: { total: allItems.length, withCoords: withCoordinates, withoutCoords: allItems.length - withCoordinates, categories: categoryStats },
    categories,
  };
}

function deferred<Value>() {
  let resolve!: (value: Value) => void;
  const promise = new Promise<Value>((resolvePromise) => { resolve = resolvePromise; });
  return { promise, resolve };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.readiness.mockResolvedValue(undefined);
});

afterEach(() => {
  try {
    expect(mocks.execute).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  } finally {
    vi.restoreAllMocks();
  }
});

describe("request-local Node0Tb prefix memo with the legacy first-match policy", () => {
  it("scans a repeated positive base only once in the actual service", async () => {
    const rows = makeRows(["HIT-SP1", "hit-sp2", " HIT-SP3"]);
    const nodes = makeNodes([coordinate("DECOY", 4), coordinate("HIT-EXT", 0, "positive <winner>", 0)]);
    useFixture(rows, nodes);
    const { result, counts, maps } = await observeScans(() => getNode0TbList());
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(result.nodes.map((item) => item.nodeDescription)).toEqual(Array(3).fill("positive <winner>"));
    expect(counts).toEqual({ scans: 1, visits: 2 });
    expect(maps).toBe(1);
    expectReads();
  });

  it("memoizes undefined for repeated missing siblings rather than scanning again", async () => {
    const rows = makeRows(["MISSING-SP1", "missing-sp2", " MISSING-SP3"]);
    const nodes = makeNodes([coordinate("OTHER", 1)]);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(result.nodes.every((item) => item.latitude === null && !item.hasCoordinates)).toBe(true);
    expect(counts).toEqual({ scans: 1, visits: nodes.length });
    expectReads();
  });

  it("keeps positive and negative bases independent across interleaved siblings", async () => {
    const rows = makeRows(["FOUND-SP1", "ABSENT-SP1", "found-SP2", "absent-SP2"]);
    const nodes = makeNodes([coordinate("FOUND-EXT", 7)]);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(counts).toEqual({ scans: 2, visits: 1 + nodes.length });
    expectReads();
  });

  it("lets a later exact full code beat an already warmed fallback for the same base", async () => {
    const rows = makeRows(["X-SP0", "X-SP2", "x-sp3", " X-sp2 "]);
    const nodes = makeNodes([coordinate("X-SP1", 11, "cached prefix"), coordinate("X-SP2", 22, "exact code")]);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result.nodes.map((item) => [item.latitude, item.nodeDescription])).toEqual([
      [11, "cached prefix"], [22, "exact code"], [11, "cached prefix"], [22, "exact code"],
    ]);
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(counts).toEqual({ scans: 1, visits: 1 });
    expectReads();
  });

  it("resolves exact base competition independently without any prefix enumeration", async () => {
    const rows = makeRows(["BASE-SP1", "base-sp2", "BASE-SP9"]);
    const nodes = makeNodes([
      coordinate("BASE-EARLIER", 99, "losing prefix"),
      coordinate("BASE", 0, "exact base", 0),
      coordinate("BASE-SP2", 2, "exact full code"),
    ]);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result.nodes.map((item) => item.nodeDescription)).toEqual(["exact base", "exact full code", "exact base"]);
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(counts).toEqual({ scans: 0, visits: 0 });
    expectReads();
  });

  it("keeps collision last-value first-slot and first rather than longest prefix in both directions", async () => {
    const rows = makeRows(["ABCD-SP1", "abcd-sp2", "LONG-SP1", "LONG-SP2"]);
    const nodes = makeNodes([
      coordinate(" a ", 1, "old collision"),
      coordinate("ABC", 3, "longer losing prefix"),
      coordinate("A", 9, "last value at first slot"),
      coordinate("a", null, "excluded collision", 5),
      coordinate("LONG-EXT-FIRST", 7, "first longer name"),
      coordinate("LONG-EXT-SECOND", 8, "later longer name"),
    ]);
    const before = JSON.stringify({ rows, nodes });
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result.nodes.map((item) => item.nodeDescription)).toEqual([
      "last value at first slot", "last value at first slot", "first longer name", "first longer name",
    ]);
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(counts).toEqual({ scans: 2, visits: 4 });
    expect(JSON.stringify({ rows, nodes })).toBe(before);
    expectReads();
  });

  it("retains zeros, null-coordinate exclusions and null or empty descriptions", async () => {
    const rows = makeRows(["ZERO-SP1", "ZERO-SP2", "NULLLAT-SP1", "NULLLON-SP1", "EMPTYDESC-SP1"]);
    const nodes = makeNodes([
      coordinate("ZERO-EXT", 0, null, 0),
      coordinate("NULLLAT", null, "excluded", 8),
      coordinate("NULLLON", 9, "excluded", null),
      coordinate("EMPTYDESC-EXT", 0, "", 3),
    ]);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(result.nodes.map((item) => [item.latitude, item.longitude, item.nodeDescription, item.hasCoordinates])).toEqual([
      [0, 0, null, true], [0, 0, null, true], [null, null, null, false], [null, null, null, false], [0, 3, "", true],
    ]);
    expect(counts.scans).toBe(4);
    expectReads();
  });

  it.each([
    ["RAW-SP1", "base selected before trimming"],
    [" RAW-sp1", "base selected before trimming"],
    ["RAW-SP1 ", "raw trailing space keeps suffix"],
    ["RAW-SP1\t", "raw trailing space keeps suffix"],
  ])("preserves strip-before-trim behavior for %j", async (code, description) => {
    const rows = makeRows([code, code]);
    const nodes = makeNodes([
      coordinate("RAW-SP2", 2, "base selected before trimming"),
      coordinate("RAW-SP1-TAIL", 1, "raw trailing space keeps suffix"),
    ]);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(result.nodes.map((item) => item.nodeDescription)).toEqual([description, description]);
    expect(counts.scans).toBe(1);
    expectReads();
  });

  it.each(["RAW-SP1\n", "RAW-SP1\r\n", "điểm-SP1", "ĐIE\u0302\u0309M-SP1", "<node>&\"-SP1"])("preserves legacy line endings and Unicode or HTML-like strings for %j", async (code) => {
    const rows = makeRows([code, code]);
    const nodes = makeNodes([
      coordinate("RAW-SP2", 2), coordinate("RAW-SP1-TAIL", 1),
      coordinate(" ĐIỂM-EXT ", 3, "<script>không đổi</script> & \"raw\""),
      coordinate("<NODE>&\"-EXT", 4, "<b>raw</b>"),
    ]);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(result.nodes.map((item) => item.nodeCode)).toEqual([code, code]);
    expect(counts.scans).toBe(1);
    expectReads();
  });

  it("memoizes the empty base without changing its first valid entry fallback", async () => {
    const rows = makeRows(["", "  ", "\t"]);
    const nodes = makeNodes([coordinate("FIRST", 0, "blank fallback", 4), coordinate("SECOND", 8)]);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(result.nodes.map((item) => item.nodeDescription)).toEqual(Array(3).fill("blank fallback"));
    expect(counts).toEqual({ scans: 1, visits: 1 });
    expectReads();
  });

  it("keeps a valid empty node key as an exact hit or first prefix candidate", async () => {
    const rows = makeRows([" ", "NONEMPTY-SP1", "NONEMPTY-SP2"]);
    const nodes = makeNodes([coordinate(" ", 0, "empty node name", 0), coordinate("NONEMPTY-EXT", 9)]);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(result.nodes.map((item) => item.nodeDescription)).toEqual(Array(3).fill("empty node name"));
    expect(counts).toEqual({ scans: 1, visits: 1 });
    expectReads();
  });

  const dtoRows = makeRows([
    { id: "prefix\"'<>&", nodeCode: "DTO-SP1", categoryKd: "Group <A> & \"0\"", totalPort: 0, dateKd: "2026-10-01", dateKdRaw: "raw <date>", dateKdFormatted: "formatted <date>", note: "<script>raw</script>" },
    { nodeCode: "dto-sp2", categoryKd: "Group B", usedPort: 3, dateKdRaw: "raw <date>", dateKdFormatted: "", note: "" },
    { nodeCode: "VOID-SP1", categoryKd: "Group B", totalPort: 16 },
    { nodeCode: "VOID-SP2", categoryKd: "", dateKdRaw: "" },
    { nodeCode: "EXACT", categoryKd: "   ", usedPort: 0, dateKdFormatted: "0" },
    { nodeCode: "BASE-SP1", categoryKd: null, dateKdRaw: "  " },
  ]);
  const dtoNodes = makeNodes([
    coordinate("DTO-EXT", 0, "description-only <search> & đậm", 1),
    coordinate("EXACT", 2, null), coordinate("BASE", 3, ""),
  ]);

  it.each([
    ["full", undefined],
    ["description-only warmed fallback", { search: "DESCRIPTION-ONLY <search>" }],
    ["category", { category: "group b" }],
    ["combined", { search: "description-only", category: "group b" }],
    ["ALL", { category: "ALL" }],
    ["lowercase all is a real category filter", { category: "all" }],
    ["code search", { search: "void" }],
    ["category search", { search: "group b" }],
    ["whitespace search", { search: "  " }],
    ["no match", { search: "not-in-fixture" }],
  ] as Array<[string, Filters]>)("matches the complete old-scan response for %s without mutating frozen inputs", async (_label, filters) => {
    const before = JSON.stringify({ rows: dtoRows, nodes: dtoNodes });
    const expected = legacyResponse(dtoRows, dtoNodes, filters);
    useFixture(dtoRows, dtoNodes);
    const { result, counts } = await observeScans(() => getNode0TbList(filters));
    expect(result).toEqual(expected);
    expect(result.nodes.map((item) => item.id)).toEqual(expected.nodes.map((item) => item.id));
    expect(result.stats).toEqual({
      total: 6, withCoords: 4, withoutCoords: 2,
      categories: [
        { category: "Group <A> & \"0\"", count: 1, withCoords: 1 },
        { category: "Group B", count: 2, withCoords: 1 },
        { category: "Chưa phân loại", count: 2, withCoords: 1 },
        { category: "   ", count: 1, withCoords: 1 },
      ],
    });
    expect(result.categories).toEqual(["Group <A> & \"0\"", "Group B", "Chưa phân loại", "   "]);
    expect(counts).toEqual({ scans: 2, visits: 1 + dtoNodes.length });
    expect(JSON.stringify({ rows: dtoRows, nodes: dtoNodes })).toBe(before);
    expect(Object.isFrozen(dtoRows) && dtoRows.every(Object.isFrozen)).toBe(true);
    expect(Object.isFrozen(dtoNodes) && dtoNodes.every(Object.isFrozen)).toBe(true);
    expectReads();
  });

  it("keeps real import utilities and date fallbacks available without utility mocks", () => {
    const parsed = parseImportDate("29/10/2026")!;
    expect([parsed.getFullYear(), parsed.getMonth(), parsed.getDate()]).toEqual([2026, 9, 29]);
    expect(toTrimmedString(" raw ")).toBe("raw");
    expect(parseFlexibleDate("29/10/2026")).toEqual({ date: parsed, formatted: "29/10/2026", raw: "29/10/2026" });
    expect(parseFlexibleDate(" <unknown> ")).toEqual({ date: null, formatted: "<unknown>", raw: "<unknown>" });
  });

  it("retains both reads for empty rows without scanning prefixes", async () => {
    const rows = makeRows([]);
    const nodes = makeNodes([], false);
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result).toEqual({ nodes: [], stats: { total: 0, withCoords: 0, withoutCoords: 0, categories: [] }, categories: [] });
    expect(counts).toEqual({ scans: 0, visits: 0 });
    expectReads();
  });

  it.each(["empty node rows", "only null-coordinate nodes"])("memoizes missing bases with %s using the real empty map iterator", async (fixture) => {
    const rows = makeRows(["ABSENT-SP1", "absent-sp2", "ABSENT-SP3"]);
    const nodes = makeNodes(fixture === "empty node rows" ? [] : [coordinate("ABSENT", null)], false);
    useFixture(rows, nodes);
    const { result, counts, maps } = await observeScans(() => getNode0TbList(), true);
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(counts).toEqual({ scans: 1, visits: 0 });
    expect(maps).toBe(1);
    expectReads();
  });

  it("retains only the first 1000 fallback bases, including misses, without eviction or consuming budget on exact hits", async () => {
    const exactCodes = Array.from({ length: 1001 }, (_, index) => `EXACT${String(index).padStart(4, "0")}!`);
    const baseCodes = Array.from({ length: 1001 }, (_, index) => `CAP${String(index).padStart(4, "0")}!`);
    const rows = makeRows([
      ...exactCodes, "BASEONLY-SP1", ...baseCodes.map((base) => `${base}-SP1`),
      `${baseCodes[0]}-SP2`, `${baseCodes[999]}-SP2`, `${baseCodes[1000]}-SP2`,
    ]);
    const nodes = makeNodes([
      ...exactCodes.map((code) => coordinate(code, 4)), coordinate("BASEONLY", 5),
      ...baseCodes.filter((_, index) => index % 2 === 0).map((code) => coordinate(`${code}-EXT`, 7)),
    ]);
    const before = JSON.stringify({ rows, nodes });
    useFixture(rows, nodes);
    const { result, counts } = await observeScans(() => getNode0TbList());
    expect(result).toEqual(legacyResponse(rows, nodes));
    expect(counts.scans).toBe(1002);
    expect(result.nodes.slice(-3).map((item) => item.latitude)).toEqual([7, null, 7]);
    expect(JSON.stringify({ rows, nodes })).toBe(before);
    expectReads();
  });

  it("creates a fresh 1000-entry budget on every call", async () => {
    const bases = Array.from({ length: 1001 }, (_, index) => `RESET${String(index).padStart(4, "0")}!`);
    const rows = makeRows([...bases.map((base) => `${base}-SP1`), `${bases[0]}-SP2`, `${bases[1000]}-SP2`]);
    const firstNodes = makeNodes([coordinate(`${bases[0]}-EXT`, 1, "first call")]);
    const secondNodes = makeNodes([coordinate(`${bases[0]}-EXT`, 9, "second call"), coordinate(`${bases[1000]}-EXT`, 8)]);
    mocks.query.mockResolvedValue(rows);
    mocks.findNodes.mockResolvedValueOnce(firstNodes).mockResolvedValueOnce(secondNodes);
    const { result, counts, maps } = await observeScans(async () => [await getNode0TbList(), await getNode0TbList()]);
    expect(result).toEqual([legacyResponse(rows, firstNodes), legacyResponse(rows, secondNodes)]);
    expect(counts.scans).toBe(2004);
    expect(maps).toBe(2);
    expect(result.map((response) => response.nodes[0].nodeDescription)).toEqual(["first call", "second call"]);
    expectReads(2);
  });

  it("resets coordinates, descriptions, hits and misses across sequential calls", async () => {
    const rows = makeRows(["CHANGE-SP1", "LATER-SP1", "CHANGE-SP2", "LATER-SP2"]);
    const snapshots = [
      makeNodes([coordinate("CHANGE-EXT", 1, "before")]),
      makeNodes([coordinate("CHANGE-EXT", 9, "after"), coordinate("LATER-EXT", 0, "new hit", 0)]),
      makeNodes([coordinate("LATER-EXT", 7, "still present")]),
    ];
    const before = JSON.stringify({ rows, snapshots });
    mocks.query.mockResolvedValue(rows);
    for (const snapshot of snapshots) mocks.findNodes.mockResolvedValueOnce(snapshot);
    const { result, counts, maps } = await observeScans(async () => [await getNode0TbList(), await getNode0TbList(), await getNode0TbList()]);
    expect(result).toEqual(snapshots.map((nodes) => legacyResponse(rows, nodes)));
    expect(result.map((response) => response.nodes.slice(0, 2).map((item) => item.latitude))).toEqual([[1, null], [9, 0], [null, 7]]);
    expect(counts.scans).toBe(6);
    expect(maps).toBe(3);
    expect(JSON.stringify({ rows, snapshots })).toBe(before);
    expectReads(3);
  });

  it("isolates genuinely overlapping calls resolved in reverse order with different hits and misses", async () => {
    const firstRows = makeRows(["SHARED-SP1", "FIRSTONLY-SP1", "SHARED-SP2", "FIRSTONLY-SP2"]);
    const secondRows = makeRows(["SHARED-SP1", "SECONDONLY-SP1", "SHARED-SP2", "SECONDONLY-SP2"]);
    const firstNodes = makeNodes([coordinate("SHARED-EXT", 1, "first request")]);
    const secondNodes = makeNodes([coordinate("SHARED-EXT", 2, "second request"), coordinate("SECONDONLY-EXT", 3)]);
    const before = JSON.stringify({ firstRows, secondRows, firstNodes, secondNodes });
    const firstRead = deferred<readonly CoordinateRow[]>();
    const secondRead = deferred<readonly CoordinateRow[]>();
    const bothReading = deferred<void>();
    mocks.query.mockResolvedValueOnce(firstRows).mockResolvedValueOnce(secondRows);
    mocks.findNodes.mockImplementationOnce(() => firstRead.promise).mockImplementationOnce(() => {
      bothReading.resolve();
      return secondRead.promise;
    });
    const { result, counts, maps } = await observeScans(async () => {
      const first = getNode0TbList();
      const second = getNode0TbList();
      await bothReading.promise;
      expect(mocks.findNodes).toHaveBeenCalledTimes(2);
      secondRead.resolve(secondNodes);
      const secondResult = await second;
      firstRead.resolve(firstNodes);
      return [await first, secondResult];
    });
    expect(result).toEqual([legacyResponse(firstRows, firstNodes), legacyResponse(secondRows, secondNodes)]);
    expect(result.map((response) => response.nodes[0].nodeDescription)).toEqual(["first request", "second request"]);
    expect(counts.scans).toBe(4);
    expect(maps).toBe(2);
    expect(JSON.stringify({ firstRows, secondRows, firstNodes, secondNodes })).toBe(before);
    expectReads(2);
  });

  it.each(["readiness", "query", "findNodes"] as const)("propagates %s failures without extra reads or writes", async (boundary) => {
    useFixture(makeRows(["FAIL-SP1"]), makeNodes([coordinate("FAIL-EXT", 1)]));
    const failure = new Error(`synthetic ${boundary} failure`);
    mocks[boundary].mockRejectedValue(failure);
    await expect(getNode0TbList()).rejects.toBe(failure);
    expect(mocks.readiness).toHaveBeenCalledExactlyOnceWith("node0tb");
    expect(mocks.query).toHaveBeenCalledTimes(boundary === "readiness" ? 0 : 1);
    expect(mocks.findNodes).toHaveBeenCalledTimes(boundary === "findNodes" ? 1 : 0);
  });
});
