// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WritingAssistantMenu } from "./writing-menu";
import { WRITING_MAX_TEXT_LENGTH } from "./writing-task";

const { runWritingTask } = vi.hoisted(() => ({ runWritingTask: vi.fn() }));

vi.mock("@/services/ai.service", () => ({
  AIService: class {
    runWritingTask = runWritingTask;
  },
}));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/components/editor/rich-text", () => ({
  RichTextEditor: ({ initialValue }: { initialValue: string }) => <div data-testid="preview">{initialValue}</div>,
}));

const renderMenu = (selection = "Some **text**") => {
  const props = { onReplace: vi.fn(), onInsertBelow: vi.fn(), onClose: vi.fn() };
  render(<WritingAssistantMenu selection={selection} workspaceId="w1" workspaceSlug="acme" {...props} />);
  return props;
};

beforeEach(() => runWritingTask.mockReset());

describe("WritingAssistantMenu", () => {
  it("runs an action on the selection and replaces it with the result", async () => {
    runWritingTask.mockResolvedValue("<p>Better</p>");
    const { onReplace } = renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "ai_writing.actions.rephrase" }));

    expect(runWritingTask).toHaveBeenCalledWith(
      "acme",
      { action: "rephrase", text: "Some **text**" },
      expect.any(AbortSignal)
    );
    expect(await screen.findByTestId("preview")).toHaveProperty("textContent", "<p>Better</p>");
    fireEvent.click(screen.getByRole("button", { name: "ai_writing.result.replace" }));
    expect(onReplace).toHaveBeenCalledWith("<p>Better</p>");
  });

  it("sends a tone and inserts the result below", async () => {
    runWritingTask.mockResolvedValue("<p>Hey</p>");
    const { onInsertBelow } = renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "ai_writing.tone.casual" }));
    fireEvent.click(await screen.findByRole("button", { name: "ai_writing.result.insert_below" }));

    expect(runWritingTask.mock.calls[0]?.[1]).toEqual({ action: "adjust_tone", tone: "casual", text: "Some **text**" });
    expect(onInsertBelow).toHaveBeenCalledWith("<p>Hey</p>");
  });

  it("sends the typed instruction", async () => {
    runWritingTask.mockResolvedValue("<p>Hallo</p>");
    renderMenu();

    const input = screen.getByRole("textbox", { name: "ai_writing.instruction_placeholder" });
    fireEvent.change(input, { target: { value: "  Translate to German  " } });
    fireEvent.submit(input);

    await screen.findByTestId("preview");
    expect(runWritingTask.mock.calls[0]?.[1]).toEqual({
      action: "custom",
      instruction: "Translate to German",
      text: "Some **text**",
    });
  });

  it("tries the same task again", async () => {
    runWritingTask.mockResolvedValueOnce("<p>One</p>").mockResolvedValueOnce("<p>Two</p>");
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "ai_writing.actions.summarize" }));
    fireEvent.click(await screen.findByRole("button", { name: "ai_writing.result.try_again" }));

    await waitFor(() => expect(screen.getByTestId("preview").textContent).toBe("<p>Two</p>"));
    expect(runWritingTask.mock.calls[1]?.[1]).toEqual(runWritingTask.mock.calls[0]?.[1]);
  });

  it("shows an error for a selection over the limit without a request, and discards", async () => {
    const { onClose } = renderMenu("x".repeat(WRITING_MAX_TEXT_LENGTH + 1));

    fireEvent.click(screen.getByRole("button", { name: "ai_writing.actions.elaborate" }));

    expect((await screen.findByRole("alert")).textContent).toBe("ai_writing.errors.too_long");
    expect(runWritingTask).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "ai_writing.result.discard" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("disables the actions without a selection", () => {
    renderMenu("");
    expect(screen.getByRole("button", { name: "ai_writing.actions.rephrase" })).toHaveProperty("disabled", true);
  });
});
