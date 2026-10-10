// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntakeEnableControl } from "./intake-enable-control";

const project = vi.hoisted(() => ({ current: { inbox_view: false } }));

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/use-preselected-issue-type", () => ({ useProjectIssueTypes: () => undefined }));
vi.mock("@/hooks/store/use-project", () => ({
  useProject: () => ({ getProjectById: () => project.current, updateProject: vi.fn(), enableIntake: vi.fn() }),
}));
vi.mock("@/components/dropdowns/issue-type", () => ({
  IssueTypeDropdown: (props: { placeholder?: string }) => <span>{props.placeholder}</span>,
}));

const toggle = () => screen.getByRole("switch", { name: "project_settings.features.intake.toggle_title" });
const isDisabled = (element: HTMLElement) =>
  element.hasAttribute("disabled") ||
  element.getAttribute("aria-disabled") === "true" ||
  element.hasAttribute("data-disabled");

describe("IntakeEnableControl", () => {
  it("asks for the intake type before intake can be turned on", () => {
    project.current = { inbox_view: false };
    render(<IntakeEnableControl workspaceSlug="dev" projectId="p1" />);

    expect(screen.getByText("project_settings.features.intake.type_placeholder")).not.toBeNull();
    expect(isDisabled(toggle())).toBe(true);
  });

  it("turns intake off without asking for a type", () => {
    project.current = { inbox_view: true };
    render(<IntakeEnableControl workspaceSlug="dev" projectId="p1" />);

    expect(screen.queryByText("project_settings.features.intake.type_placeholder")).toBeNull();
    expect(isDisabled(toggle())).toBe(false);
  });
});
