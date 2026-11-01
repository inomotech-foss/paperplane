// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@plane/services";
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

const apiError = (status: number, data: unknown) => new ApiError(new Response(null, { status }), data);

const renderMenu = (selection = "Some **text**", canReplace = true) => {
  const props = { onReplace: vi.fn(), onInsertBelow: vi.fn(), onClose: vi.fn() };
  render(
    <WritingAssistantMenu
      selection={selection}
      canReplace={canReplace}
      workspaceId="w1"
      workspaceSlug="acme"
      {...props}
    />
  );
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

  it("shows a missing LLM", async () => {
    runWritingTask.mockRejectedValueOnce(apiError(503, { error: "x", code: "llm_not_configured" }));
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "ai_writing.actions.simplify" }));

    expect((await screen.findByRole("alert")).textContent).toBe("ai_writing.errors.not_configured");
  });

  it("recovers from a provider error with Try again", async () => {
    runWritingTask
      .mockRejectedValueOnce(apiError(502, { error: "x", code: "provider_error" }))
      .mockResolvedValueOnce("<p>Fine</p>");
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "ai_writing.actions.rephrase" }));
    expect((await screen.findByRole("alert")).textContent).toBe("ai_writing.errors.generic");
    fireEvent.click(screen.getByRole("button", { name: "ai_writing.result.try_again" }));

    expect((await screen.findByTestId("preview")).textContent).toBe("<p>Fine</p>");
    expect(runWritingTask).toHaveBeenCalledTimes(2);
  });

  it("shows a server rejection of the text as too long", async () => {
    runWritingTask.mockRejectedValueOnce(apiError(400, { text: ["Too long"] }));
    renderMenu();

    fireEvent.click(screen.getByRole("button", { name: "ai_writing.actions.summarize" }));

    expect((await screen.findByRole("alert")).textContent).toBe("ai_writing.errors.too_long");
  });

  it("offers only Insert below when a replace would lose nodes", async () => {
    runWritingTask.mockResolvedValue("<p>Better</p>");
    renderMenu("Ask @someone", false);

    fireEvent.click(screen.getByRole("button", { name: "ai_writing.actions.rephrase" }));

    await screen.findByRole("button", { name: "ai_writing.result.insert_below" });
    expect(screen.queryByRole("button", { name: "ai_writing.result.replace" })).toBeNull();
    expect(screen.getByText("ai_writing.result.replace_unavailable")).toBeTruthy();
  });

  it("disables the actions without a selection", () => {
    renderMenu("");
    expect(screen.getByRole("button", { name: "ai_writing.actions.rephrase" })).toHaveProperty("disabled", true);
  });
});
