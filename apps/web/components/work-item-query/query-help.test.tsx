// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TPqlDialect, TWorkItemQueryFields } from "@plane/types";
import { WorkItemQueryHelp } from "./query-help";

vi.mock("@plane/i18n", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => (params ? `${key}:${Object.values(params).join(",")}` : key),
  }),
}));

const fields: TWorkItemQueryFields = {
  fields: [
    {
      name: "target_date",
      type: "date",
      lookups: ["exact", "lt"],
      operators: ["=", "<"],
      choices: null,
      aliases: ["due_date"],
      plane_aliases: ["dueDate", "targetDate"],
      people: false,
    },
  ],
  unsupported: {},
  functions: [
    { name: "openStates", kind: "list", arguments: 0 },
    { name: "today", kind: "value", arguments: 0 },
  ],
  custom_property_syntax: 'cf["<property id or name>"]',
};

/** Base UI commits a mouse pick only when the press started on the option. */
const pick = async (name: string) => {
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
};

const renderHelp = (dialect: TPqlDialect, memberDialect: TPqlDialect | null = null) => {
  const onDialectChange = vi.fn();
  render(
    <WorkItemQueryHelp
      fields={fields}
      dialect={dialect}
      workspaceDialect="jql"
      memberDialect={memberDialect}
      onDialectChange={onDialectChange}
      onClose={() => {}}
    />
  );
  return { onDialectChange };
};

describe("WorkItemQueryHelp", () => {
  it("lists JQL names and every function in the jql dialect", () => {
    renderHelp("jql");
    expect(screen.getByText("due_date")).toBeTruthy();
    expect(screen.queryByText("dueDate")).toBeNull();
    expect(screen.getByText("today()")).toBeTruthy();
    // The parser takes list functions in both dialects, and the help listed them before the setting existed.
    expect(screen.getByText("openStates()")).toBeTruthy();
    expect(screen.getByText(/state_group in \(unstarted, started\)/)).toBeTruthy();
  });

  it("lists Plane names, list functions and Plane examples in the plane dialect", () => {
    renderHelp("plane");
    expect(screen.getByText("dueDate")).toBeTruthy();
    expect(screen.queryByText("due_date")).toBeNull();
    expect(screen.getByText("openStates()")).toBeTruthy();
    expect(screen.getByText(/stateGroup in activeStates\(\)/)).toBeTruthy();
  });

  it("sets the member's own dialect, or clears it to follow the workspace", async () => {
    const { onDialectChange } = renderHelp("jql");
    const trigger = screen.getByRole("combobox", { name: "work_item_query.dialect" });
    expect(trigger.textContent).toContain("work_item_query.dialect_default:JQL");

    fireEvent.click(trigger);
    await pick("Plane");
    await waitFor(() => expect(onDialectChange).toHaveBeenLastCalledWith("plane"));

    fireEvent.click(trigger);
    await pick("work_item_query.dialect_default:JQL");
    await waitFor(() => expect(onDialectChange).toHaveBeenLastCalledWith(null));
  });

  it("shows the member's own choice as selected", () => {
    renderHelp("plane", "plane");
    expect(screen.getByRole("combobox", { name: "work_item_query.dialect" }).textContent).toContain("Plane");
  });
});
