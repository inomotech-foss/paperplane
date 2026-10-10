// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";
import { IntakeEnableControl } from "./intake-enable-control";

const project = vi.hoisted(() => ({ current: { inbox_view: false } }));

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-preselected-issue-type", () => ({ useProjectIssueTypes: () => undefined }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => project.current, updateProject: vi.fn(), enableIntake: vi.fn() }),
}));
const intake = vi.hoisted(() => ({ current: {} as { issue_type?: string } }));
vi.mock("@/services/inbox/intake-settings.service", () => ({
  IntakeSettingsService: class {
    getIntake = () => Promise.resolve(intake.current);
  },
}));
vi.mock("@/components/dropdowns/issue-type", () => ({
  IssueTypeDropdown: (props: { placeholder?: string; value?: string }) => (
    <span>{props.value ?? props.placeholder}</span>
  ),
}));

const toggle = () => screen.getByRole("switch", { name: "project_settings.features.intake.toggle_title" });
const isDisabled = (element: HTMLElement) =>
  element.hasAttribute("disabled") ||
  element.getAttribute("aria-disabled") === "true" ||
  element.hasAttribute("data-disabled");

const renderControl = () =>
  render(
    <SWRConfig value={{ provider: () => new Map() }}>
      <IntakeEnableControl workspaceSlug="dev" projectId="p1" />
    </SWRConfig>
  );

describe("IntakeEnableControl", () => {
  it("asks for the intake type before intake can be turned on", () => {
    project.current = { inbox_view: false };
    intake.current = {};
    renderControl();

    expect(screen.getByText("project_settings.features.intake.type_placeholder")).not.toBeNull();
    expect(isDisabled(toggle())).toBe(true);
  });

  it("turns intake off without asking for a type", () => {
    project.current = { inbox_view: true };
    renderControl();

    expect(screen.queryByText("project_settings.features.intake.type_placeholder")).toBeNull();
    expect(isDisabled(toggle())).toBe(false);
  });

  it("turns an intake that was on before back on with its type", async () => {
    project.current = { inbox_view: false };
    intake.current = { issue_type: "ticket" };
    renderControl();

    await waitFor(() => expect(screen.getByText("ticket")).not.toBeNull());
    expect(isDisabled(toggle())).toBe(false);
  });
});
