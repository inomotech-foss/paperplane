import { describe, expect, it } from "vitest";
import { DEFAULT_GANTT_EXPANSION, buildGanttRows, showGanttLevels, toggleGanttRow } from "./hierarchy";

const parents = (map: Record<string, string | null>) => (id: string) => map[id];

// customer > story > quote > two invoices, plus a second customer
const FUNNEL = ["customer", "story", "quote", "inv1", "inv2", "other"];
const FUNNEL_PARENTS = parents({
  customer: null,
  story: "customer",
  quote: "story",
  inv1: "quote",
  inv2: "quote",
  other: null,
});

describe("buildGanttRows", () => {
  it("shows the whole tree depth first by default", () => {
    const { visibleIds, rows, levelCount } = buildGanttRows({
      issueIds: FUNNEL,
      getParentId: FUNNEL_PARENTS,
      expansion: DEFAULT_GANTT_EXPANSION,
    });

    expect(visibleIds).toEqual(["customer", "story", "quote", "inv1", "inv2", "other"]);
    expect(rows.get("inv2")?.depth).toBe(3);
    expect(rows.get("quote")?.childIds).toEqual(["inv1", "inv2"]);
    expect(levelCount).toBe(4);
  });

  it("collapse all keeps only the top level but still counts every level", () => {
    const { visibleIds, levelCount } = buildGanttRows({
      issueIds: FUNNEL,
      getParentId: FUNNEL_PARENTS,
      expansion: showGanttLevels(1),
    });

    expect(visibleIds).toEqual(["customer", "other"]);
    expect(levelCount).toBe(4);
  });

  it("shows a chosen number of levels", () => {
    const { visibleIds } = buildGanttRows({
      issueIds: FUNNEL,
      getParentId: FUNNEL_PARENTS,
      expansion: showGanttLevels(2),
    });

    expect(visibleIds).toEqual(["customer", "story", "other"]);
  });

  it("folding a row hides everything below it, and a hand toggle beats the default", () => {
    const folded = toggleGanttRow(DEFAULT_GANTT_EXPANSION, "story", true);
    expect(buildGanttRows({ issueIds: FUNNEL, getParentId: FUNNEL_PARENTS, expansion: folded }).visibleIds).toEqual([
      "customer",
      "story",
      "other",
    ]);

    const unfolded = toggleGanttRow(showGanttLevels(1), "customer", false);
    expect(buildGanttRows({ issueIds: FUNNEL, getParentId: FUNNEL_PARENTS, expansion: unfolded }).visibleIds).toEqual([
      "customer",
      "story",
      "other",
    ]);
  });

  it("expand all forgets hand toggles", () => {
    const folded = toggleGanttRow(DEFAULT_GANTT_EXPANSION, "customer", true);
    expect(showGanttLevels(null)).toEqual(DEFAULT_GANTT_EXPANSION);
    expect(folded.overrides.customer).toBe(false);
  });

  it("nests children fetched separately after the listed ones", () => {
    const { visibleIds, rows } = buildGanttRows({
      issueIds: ["customer", "other"],
      getParentId: FUNNEL_PARENTS,
      getFetchedChildIds: (id) => (id === "customer" ? ["story"] : undefined),
      expansion: DEFAULT_GANTT_EXPANSION,
    });

    expect(visibleIds).toEqual(["customer", "story", "other"]);
    expect(rows.get("story")?.depth).toBe(1);
  });

  it("keeps the view's order among siblings", () => {
    const { visibleIds } = buildGanttRows({
      issueIds: ["b", "a2", "a", "a1"],
      getParentId: parents({ b: null, a: null, a1: "a", a2: "a" }),
      expansion: DEFAULT_GANTT_EXPANSION,
    });

    expect(visibleIds).toEqual(["b", "a", "a2", "a1"]);
  });

  it("never loses the members of a parent cycle", () => {
    const { visibleIds } = buildGanttRows({
      issueIds: ["x", "y", "z"],
      getParentId: parents({ x: "y", y: "x", z: "y" }),
      expansion: DEFAULT_GANTT_EXPANSION,
    });

    expect(new Set(visibleIds)).toEqual(new Set(["x", "y", "z"]));
    expect(visibleIds).toHaveLength(3);
  });

  it("renders a work item only once even if a fetched child is also listed elsewhere", () => {
    const { visibleIds } = buildGanttRows({
      issueIds: ["customer", "story"],
      getParentId: parents({ customer: null, story: "customer" }),
      getFetchedChildIds: (id) => (id === "customer" ? ["story", "story"] : undefined),
      expansion: DEFAULT_GANTT_EXPANSION,
    });

    expect(visibleIds).toEqual(["customer", "story"]);
  });
});
