// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TAutomation, TAutomationAction, TAutomationActionConfig } from "@plane/types";
import { AutomationActionsBlock } from "./actions-block";

const store = vi.hoisted(() => ({ createAction: vi.fn(), updateAction: vi.fn(), deleteAction: vi.fn() }));

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/store/use-automation", () => ({ useAutomation: () => store }));
vi.mock("../helpers/metadata", () => ({
  allowedActions: () => [{ key: "add_comment", i18n_label: "Add comment" }],
  findAction: () => undefined,
}));
vi.mock("./action-config", () => ({
  actionNeedsConfig: () => true,
  AutomationActionConfig: (props: { onChange: (config: TAutomationActionConfig) => Promise<boolean> }) => (
    <button type="button" onClick={() => void props.onChange({ comment_html: "<p>Hi</p>" })}>
      fill
    </button>
  ),
}));
vi.mock("@makeplane/propel/components/menu", () => ({
  Menu: (props: { children: React.ReactNode }) => <>{props.children}</>,
  MenuTrigger: () => null,
  MenuContent: (props: { children: React.ReactNode }) => <>{props.children}</>,
  MenuItem: (props: { label: string; onClick: () => void }) => (
    <button type="button" onClick={props.onClick}>
      {props.label}
    </button>
  ),
}));

const makeAction = (
  id: string,
  action_type: TAutomationAction["action_type"],
  sort_order: number
): TAutomationAction => ({
  id,
  automation: "rule-1",
  action_type,
  config: {},
  sort_order,
  created_at: "",
  updated_at: "",
  created_by: null,
});

const makeAutomation = (actions: TAutomationAction[]): TAutomation => ({
  id: "rule-1",
  workspace: "ws",
  project: "p1",
  scope: "project",
  projects: [],
  applies_to_all_projects: false,
  name: "Rule",
  description: "",
  trigger_type: "work_item_created",
  trigger_config: {},
  condition: null,
  is_enabled: false,
  next_run_at: null,
  last_run_at: null,
  last_run_status: null,
  total_run_count: 0,
  failed_run_count: 0,
  average_duration_ms: null,
  schedule_summary: null,
  owned_by: null,
  actions,
  created_at: "",
  updated_at: "",
  created_by: null,
  updated_by: null,
});

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {};
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

const renderBlock = (actions: TAutomationAction[]) => {
  const view = render(
    <AutomationActionsBlock
      workspaceSlug="ws"
      projectId="p1"
      automation={makeAutomation(actions)}
      metadata={undefined}
    />
  );
  const rerender = (next: TAutomationAction[]) =>
    view.rerender(
      <AutomationActionsBlock
        workspaceSlug="ws"
        projectId="p1"
        automation={makeAutomation(next)}
        metadata={undefined}
      />
    );
  return { rerender };
};

const titles = () => screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);

describe("AutomationActionsBlock", () => {
  it("numbers a newly saved action by its sort order", async () => {
    const stored = makeAction("a1", "change_property", 200);
    const created = { ...makeAction("a2", "add_comment", 100), config: { comment_html: "<p>Hi</p>" } };
    store.createAction.mockResolvedValueOnce(created);
    const { rerender } = renderBlock([stored]);

    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    expect(titles()).toEqual(["change_property", "add_comment"]);

    const newCardFill = screen.getAllByRole("button", { name: "fill" }).at(-1);
    if (!newCardFill) throw new Error("missing new card");
    await act(async () => {
      fireEvent.click(newCardFill);
    });
    rerender([stored, created]);

    expect(titles()).toEqual(["add_comment", "change_property"]);
  });

  it("deletes a new action whose create was still in flight", async () => {
    const created = makeAction("a2", "add_comment", 100);
    const creating = deferred<TAutomationAction>();
    store.createAction.mockReturnValueOnce(creating.promise);
    store.deleteAction.mockResolvedValueOnce(undefined);
    const { rerender } = renderBlock([]);

    fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    fireEvent.click(screen.getByRole("button", { name: "fill" }));
    fireEvent.click(screen.getByRole("button", { name: "automations.designer.remove_action" }));
    expect(store.deleteAction).not.toHaveBeenCalled();

    await act(async () => {
      creating.resolve(created);
    });
    rerender([]);

    expect(store.deleteAction).toHaveBeenCalledExactlyOnceWith("ws", "rule-1", "a2", "p1");
    expect(screen.queryAllByRole("heading", { level: 4 })).toEqual([]);
  });
});
