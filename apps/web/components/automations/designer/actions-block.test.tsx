// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
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
  AutomationActionConfig: (props: {
    config: TAutomationActionConfig;
    onChange: (config: TAutomationActionConfig) => Promise<boolean>;
  }) => (
    <div>
      <output>{JSON.stringify(props.config)}</output>
      <button type="button" onClick={() => void props.onChange({ comment_html: "" })}>
        fill
      </button>
    </div>
  ),
}));
vi.mock("@/helpers/error.helper", () => ({ getApiErrorBody: (error: unknown) => error }));
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
  config_error: null,
  sort_order,
  created_at: "",
  updated_at: "",
  created_by: null,
});

const makeAutomation = (actions: TAutomationAction[], is_enabled = false): TAutomation => ({
  id: "rule-1",
  workspace: "ws",
  project: "p1",
  scope: "project",
  projects: [],
  applies_to_all_projects: false,
  name: "Rule",
  description: "",
  trigger_type: "work_item.created",
  trigger_config: {},
  trigger_config_error: null,
  condition: null,
  is_enabled,
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

type TRenderOptions = { isEnabled?: boolean; enableErrors?: Record<string, string> };

const renderBlock = (actions: TAutomationAction[], options: TRenderOptions = {}) => {
  const element = (next: TAutomationAction[]) => (
    <AutomationActionsBlock
      workspaceSlug="ws"
      projectId="p1"
      automation={makeAutomation(next, options.isEnabled)}
      metadata={undefined}
      enableErrors={options.enableErrors}
    />
  );
  const view = render(element(actions));
  return { rerender: (next: TAutomationAction[]) => view.rerender(element(next)) };
};

const titles = () => screen.queryAllByRole("heading", { level: 4 }).map((heading) => heading.textContent);

describe("AutomationActionsBlock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("orders the cards by sort order", () => {
    renderBlock([makeAction("a1", "change_property", 200), makeAction("a2", "add_comment", 100)]);

    expect(titles()).toEqual(["add_comment", "change_property"]);
  });

  it("creates an added action right away with its starting config", async () => {
    store.createAction.mockResolvedValueOnce(makeAction("a1", "add_comment", 100));
    renderBlock([]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Add comment" }));
    });

    expect(store.createAction).toHaveBeenCalledExactlyOnceWith(
      "ws",
      "rule-1",
      { action_type: "add_comment", config: { comment_html: "" } },
      "p1"
    );
  });

  it("shows why a stored action is incomplete", () => {
    renderBlock([{ ...makeAction("a1", "add_comment", 100), config_error: "The comment body is empty." }]);

    expect(screen.getByText("The comment body is empty.")).toBeTruthy();
  });

  it("saves an edit through the store", async () => {
    store.updateAction.mockResolvedValueOnce(makeAction("a1", "add_comment", 100));
    renderBlock([makeAction("a1", "add_comment", 100)]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "fill" }));
    });

    expect(store.updateAction).toHaveBeenCalledExactlyOnceWith(
      "ws",
      "rule-1",
      "a1",
      { config: { comment_html: "" } },
      "p1"
    );
  });

  it("keeps a refused edit on screen with the server's reason", async () => {
    store.updateAction.mockRejectedValueOnce({ config: ["The comment body is empty."] });
    renderBlock([{ ...makeAction("a1", "add_comment", 100), config: { comment_html: "<p>Hi</p>" } }], {
      isEnabled: true,
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "fill" }));
    });

    expect(screen.getByText("The comment body is empty.")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(JSON.stringify({ comment_html: "" }));
  });

  it("deletes an action", async () => {
    store.deleteAction.mockResolvedValueOnce(undefined);
    renderBlock([makeAction("a1", "add_comment", 100)]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "automations.designer.remove_action" }));
    });

    expect(store.deleteAction).toHaveBeenCalledExactlyOnceWith("ws", "rule-1", "a1", "p1");
  });

  it("shows the reasons from a refused enable on the matching cards", () => {
    renderBlock([makeAction("a1", "add_comment", 100), makeAction("a2", "call_webhook", 200)], {
      enableErrors: { a2: "The webhook needs a URL." },
    });

    const cards = screen.getAllByRole("heading", { level: 4 }).map((heading) => heading.closest("div.rounded-md"));
    expect(cards[0]?.textContent).not.toContain("The webhook needs a URL.");
    expect(cards[1]?.textContent).toContain("The webhook needs a URL.");
  });

  it("asks to disable an enabled automation before adding actions", () => {
    renderBlock([makeAction("a1", "archive_work_item", 100)], { isEnabled: true });

    expect(screen.getByText("automations.action.disable_to_add")).toBeTruthy();
  });
});
