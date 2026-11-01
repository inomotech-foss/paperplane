// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { TAutomation, TAutomationAction, TAutomationActionConfig, TAutomationActionPayload } from "@plane/types";
import { AutomationStore } from "./automation.store";

vi.mock("@plane/services", () => ({
  AutomationService: class {
    updateAction() {
      return Promise.reject(new Error("not mocked"));
    }
  },
}));

const action: TAutomationAction = {
  id: "action-1",
  automation: "rule-1",
  action_type: "create_work_item",
  config: { name: "Old", description_html: "<p>old</p>" },
  config_error: null,
  sort_order: 1,
  created_at: "",
  updated_at: "",
  created_by: null,
};

const automation: TAutomation = {
  id: "rule-1",
  workspace: "ws",
  project: "project-1",
  scope: "project",
  applies_to_all_projects: false,
  projects: ["project-1"],
  name: "Rule",
  description: "",
  trigger_type: "work_item.created",
  trigger_config: {},
  trigger_config_error: null,
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
  actions: [action],
  created_at: "",
  updated_at: "",
  created_by: null,
  updated_by: null,
};

type TDeferred = { resolve: (value: TAutomationAction) => void; reject: (error: Error) => void };

const makeStore = () => {
  const store = new AutomationStore();
  store.automationMap = { "rule-1": { ...automation, actions: [action] } };
  const requests: TDeferred[] = [];
  const updateAction = vi.fn(
    (_slug: string, _automationId: string, _actionId: string, _data: TAutomationActionPayload) =>
      new Promise<TAutomationAction>((resolve, reject) => requests.push({ resolve, reject }))
  );
  Object.assign(store.automationService, { updateAction });
  const config = () => store.automationMap["rule-1"].actions[0].config;
  const update = (next: TAutomationActionConfig) => store.updateAction("ws", "rule-1", "action-1", { config: next });
  return { store, requests, config, update, updateAction };
};

describe("AutomationStore.updateAction", () => {
  it("applies the config before the request returns", () => {
    const { config, update } = makeStore();

    void update({ name: "Old", description_html: "<p>new</p>" });

    expect(config()).toEqual({ name: "Old", description_html: "<p>new</p>" });
  });

  it("lets a second field build on the first edit while it is in flight", async () => {
    const { config, update, requests, updateAction } = makeStore();

    const first = update({ name: "Old", description_html: "<p>new</p>" });
    // the Name field builds its payload from the stored config, as the designer does
    const current = config();
    const second = update({
      name: "New",
      description_html: "description_html" in current ? current.description_html : "",
    });
    requests[0].resolve({ ...action, config: { name: "Old", description_html: "<p>new</p>" } });
    requests[1].resolve({ ...action, config: { name: "New", description_html: "<p>new</p>" } });
    await Promise.all([first, second]);

    expect(updateAction.mock.calls[1][3]).toEqual({ config: { name: "New", description_html: "<p>new</p>" } });
    expect(config()).toEqual({ name: "New", description_html: "<p>new</p>" });
  });

  it("ignores an older response that arrives after a newer edit", async () => {
    const { config, update, requests } = makeStore();

    const first = update({ name: "A", description_html: "<p>old</p>" });
    const second = update({ name: "AB", description_html: "<p>old</p>" });
    requests[1].resolve({ ...action, config: { name: "AB", description_html: "<p>old</p>" } });
    await second;
    requests[0].resolve({ ...action, config: { name: "A", description_html: "<p>old</p>" } });
    await first;

    expect(config()).toEqual({ name: "AB", description_html: "<p>old</p>" });
  });

  it("rolls back when the request fails", async () => {
    const { config, update, requests } = makeStore();

    const pending = update({ name: "Old", description_html: "<p>bad</p>" });
    requests[0].reject(new Error("400"));

    await expect(pending).rejects.toThrow("400");
    expect(config()).toEqual(action.config);
  });

  it("falls back to the server state after two refused edits in a row", async () => {
    const { config, update, requests } = makeStore();

    const first = update({ name: "", description_html: "<p>old</p>" });
    const second = update({ name: "", description_html: "" });
    requests[0].reject(new Error("400"));
    await expect(first).rejects.toThrow("400");
    requests[1].reject(new Error("400"));
    await expect(second).rejects.toThrow("400");

    expect(config()).toEqual(action.config);
  });

  it("keeps an accepted older edit when the newer one is refused", async () => {
    const { config, update, requests } = makeStore();

    const first = update({ name: "Accepted", description_html: "<p>old</p>" });
    const second = update({ name: "", description_html: "<p>old</p>" });
    requests[1].reject(new Error("400"));
    await expect(second).rejects.toThrow("400");
    requests[0].resolve({ ...action, config: { name: "Accepted", description_html: "<p>old</p>" } });
    await first;

    expect(config()).toEqual({ name: "Accepted", description_html: "<p>old</p>" });
  });
});
