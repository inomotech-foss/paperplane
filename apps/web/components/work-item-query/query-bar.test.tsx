// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkItemQueryService } from "@/services/issue";
import { WorkItemQueryBar } from "./query-bar";

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("./values", () => ({ useValuesFor: () => () => [] }));
type TEditorProps = {
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

vi.mock("./editor", () => ({
  default: ({ value, onChange, onSubmit, onCancel }: TEditorProps) => (
    <input
      aria-label="query"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onSubmit();
        if (event.key === "Escape") onCancel();
      }}
    />
  ),
}));

const DRAFT = { query: "nope = 1", error: "Unknown field" };
const editorBox = () => screen.getByRole<HTMLInputElement>("textbox", { name: "query" });
const clearButton = () => screen.queryByRole("button", { name: "work_item_query.clear" });

const setup = (value: string, draft?: { query: string; error?: string }) => {
  vi.spyOn(WorkItemQueryService.prototype, "fields").mockResolvedValue({
    fields: [],
    unsupported: {},
    functions: [],
    custom_property_syntax: "",
  });
  const onApply = vi.fn();
  const view = render(
    <WorkItemQueryBar workspaceSlug="ws" projectId="p1" value={value} draft={draft} onApply={onApply} />
  );
  return { onApply, view };
};

describe("WorkItemQueryBar", () => {
  it("clears a draft from a link through onApply, so it leaves the URL", async () => {
    const { onApply } = setup("", { query: "nope = 1", error: "Unknown field" });
    expect(await screen.findByText("Unknown field")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "work_item_query.clear" }));
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(""));
  });

  it("keeps the person's edits when the same draft arrives again", async () => {
    const draft = { query: "nope = 1", error: "Unknown field" };
    const { view, onApply } = setup("", draft);
    const editor = await screen.findByRole<HTMLInputElement>("textbox", { name: "query" });
    expect(editor.value).toBe("nope = 1");
    fireEvent.change(editor, { target: { value: "priority = high" } });

    // every load of the route returns a new draft object
    view.rerender(
      <WorkItemQueryBar workspaceSlug="ws" projectId="p1" value="" draft={{ ...draft }} onApply={onApply} />
    );
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "query" }).value).toBe("priority = high");
  });

  it("drops a draft that left the URL, e.g. after Clear all", async () => {
    const draft = { query: "nope = 1", error: "Unknown field" };
    const { view, onApply } = setup("", draft);
    await screen.findByText("Unknown field");

    view.rerender(<WorkItemQueryBar workspaceSlug="ws" projectId="p1" value="" onApply={onApply} />);
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "query" }).value).toBe("");
    expect(screen.queryByText("Unknown field")).toBeNull();
  });

  it("restores the draft and its error on Escape, and keeps Clear", async () => {
    setup("", DRAFT);
    await screen.findByText("Unknown field");
    fireEvent.change(editorBox(), { target: { value: "priority = high" } });
    fireEvent.keyDown(editorBox(), { key: "Escape" });

    expect(editorBox().value).toBe("nope = 1");
    expect(screen.getByText("Unknown field")).toBeTruthy();
    expect(clearButton()).not.toBeNull();
  });

  it("clears a draft when its text is erased and run", async () => {
    const { onApply } = setup("", DRAFT);
    await screen.findByText("Unknown field");
    fireEvent.change(editorBox(), { target: { value: "" } });
    expect(clearButton()).not.toBeNull();
    fireEvent.keyDown(editorBox(), { key: "Enter" });
    await waitFor(() => expect(onApply).toHaveBeenCalledWith(""));
  });

  it("shows another applied query in place of the person's edits", async () => {
    const { view, onApply } = setup("priority = high");
    await screen.findByRole("textbox", { name: "query" });
    fireEvent.change(editorBox(), { target: { value: "priority = low" } });

    view.rerender(<WorkItemQueryBar workspaceSlug="ws" projectId="p1" value="state = 'Done'" onApply={onApply} />);
    expect(editorBox().value).toBe("state = 'Done'");
  });

  it("shows a new draft in place of the person's edits", async () => {
    const { view, onApply } = setup("", DRAFT);
    await screen.findByText("Unknown field");
    fireEvent.change(editorBox(), { target: { value: "priority = low" } });

    const next = { query: "other = 2", error: "Other error" };
    view.rerender(<WorkItemQueryBar workspaceSlug="ws" projectId="p1" value="" draft={next} onApply={onApply} />);
    expect(editorBox().value).toBe("other = 2");
    expect(screen.getByText("Other error")).toBeTruthy();
  });
});
