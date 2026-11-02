// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { IIssueLabel } from "@plane/types";
import { CreateUpdateLabelInline } from "./create-update-label-inline";

describe("CreateUpdateLabelInline", () => {
  it("submits on Enter through a form with a submit button", async () => {
    const createLabel = vi.fn(async (data: Partial<IIssueLabel>) => ({
      id: "l1",
      name: data.name ?? "",
      color: "#f00",
      project_id: "p1",
      workspace_id: "w1",
      parent: null,
      sort_order: 0,
    }));
    render(
      <CreateUpdateLabelInline
        labelForm
        setLabelForm={vi.fn()}
        isUpdating={false}
        labelOperationsCallbacks={{ createLabel, updateLabel: vi.fn() }}
      />
    );
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Bug" } });
    const form = input.closest("form");
    expect(form?.querySelector('button[type="submit"]')).toBeTruthy();
    if (form) fireEvent.submit(form);
    await waitFor(() => expect(createLabel).toHaveBeenCalledWith(expect.objectContaining({ name: "Bug" })));
  });
});
