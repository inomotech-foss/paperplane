// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { IssueGanttBlock } from "./blocks";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("IssueGanttBlock", () => {
  it("renders the bar as a non-native button trigger without a console error", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { container } = render(
      <MemoryRouter>
        <IssueGanttBlock issueId="issue-1" />
      </MemoryRouter>
    );

    expect(errorSpy).not.toHaveBeenCalled();
    expect(container.querySelector("#issue-issue-1")?.getAttribute("role")).toBe("button");
  });
});
