// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TAutomation, TAutomationAction, TAutomationActionConfig } from "@plane/types";
import { AutomationActionsBlock } from "./actions-block";
import type { TRefusedActionEdit } from "./use-refused-action-edits";

const store = vi.hoisted(() => ({ createAction: vi.fn(), deleteAction: vi.fn() }));
const onSaveConfig = vi.fn<(actionId: string, config: TAutomationActionConfig) => Promise<boolean>>();

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

type TRenderOptions = {
  isEnabled?: boolean;
  enableErrors?: Record<string, string>;
  refusals?: Record<string, TRefusedActionEdit>;
};

const renderBlock = (actions: TAutomationAction[], options: TRenderOptions = {}) =>
  render(
    <AutomationActionsBlock
      workspaceSlug="ws"
      projectId="p1"
      automation={makeAutomation(actions, options.isEnabled)}
      metadata={undefined}
      enableErrors={options.enableErrors}
      refusals={options.refusals}
      onSaveConfig={onSaveConfig}
    />
  );

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

  it("hands an edit to the save callback", async () => {
    onSaveConfig.mockResolvedValueOnce(true);
    renderBlock([makeAction("a1", "add_comment", 100)]);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "fill" }));
    });

    expect(onSaveConfig).toHaveBeenCalledExactlyOnceWith("a1", { comment_html: "" });
  });

  it("shows a refused edit with the server's reason", () => {
    renderBlock([{ ...makeAction("a1", "add_comment", 100), config: { comment_html: "<p>Hi</p>" } }], {
      isEnabled: true,
      refusals: { a1: { config: { comment_html: "" }, message: "The comment body is empty." } },
    });

    expect(screen.getByRole("alert").textContent).toBe("The comment body is empty.");
    expect(screen.getByRole("status").textContent).toBe(JSON.stringify({ comment_html: "" }));
  });

  it("shows saving instead of the stored reason while a save is in flight", async () => {
    let resolveSave: ((saved: boolean) => void) | undefined;
    onSaveConfig.mockReturnValueOnce(
      new Promise<boolean>((resolve) => {
        resolveSave = resolve;
      })
    );
    renderBlock([{ ...makeAction("a1", "add_comment", 100), config_error: "The comment body is empty." }]);

    fireEvent.click(screen.getByRole("button", { name: "fill" }));

    expect(screen.getByText("common.saving")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    await act(async () => {
      resolveSave?.(true);
    });
    expect(screen.getByRole("alert").textContent).toBe("The comment body is empty.");
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
