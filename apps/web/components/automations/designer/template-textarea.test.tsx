// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateTextarea } from "./template-textarea";

const setup = (value: string, saved = true) => {
  const onCommit = vi.fn((_value: string) => Promise.resolve(saved));
  const view = render(<TemplateTextarea value={value} onCommit={onCommit} rows={3} placeholder="Comment" />);
  const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>("Comment");
  const rerender = (next: string) =>
    view.rerender(<TemplateTextarea value={next} onCommit={onCommit} rows={3} placeholder="Comment" />);
  return { onCommit, view, textarea, rerender };
};

const blur = async (textarea: HTMLTextAreaElement) => {
  await act(async () => {
    fireEvent.blur(textarea);
  });
};

describe("TemplateTextarea", () => {
  it("saves once on blur, not on every keystroke", async () => {
    const { onCommit, textarea } = setup("");

    fireEvent.change(textarea, { target: { value: "a <" } });
    fireEvent.change(textarea, { target: { value: "a <b>{{ work_item.name }}</b>" } });
    expect(onCommit).not.toHaveBeenCalled();
    expect(textarea.value).toBe("a <b>{{ work_item.name }}</b>");

    await blur(textarea);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("a <b>{{ work_item.name }}</b>");
  });

  it("does not save an unchanged template", async () => {
    const { onCommit, textarea } = setup('<p><a href="{{ work_item.url }}">link</a></p>');

    fireEvent.change(textarea, { target: { value: textarea.value } });
    await blur(textarea);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows the stored template after a save, even when the stored value did not change", async () => {
    const { onCommit, textarea } = setup("<p>x</p>");

    fireEvent.change(textarea, { target: { value: "<p>x</p><script>y</script>" } });
    await blur(textarea);
    expect(textarea.value).toBe("<p>x</p>");

    await blur(textarea);
    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("shows the sanitized template once the server returns it", async () => {
    const { textarea, rerender } = setup("");

    fireEvent.change(textarea, { target: { value: "a & b" } });
    await blur(textarea);
    rerender("a &amp; b");

    expect(textarea.value).toBe("a &amp; b");
  });

  it("keeps the draft when the save fails and retries on the next blur", async () => {
    const { onCommit, textarea } = setup("", false);

    fireEvent.change(textarea, { target: { value: "draft" } });
    await blur(textarea);
    expect(textarea.value).toBe("draft");

    await blur(textarea);
    expect(onCommit).toHaveBeenCalledTimes(2);
  });

  it("saves an unblurred draft on unmount", () => {
    const { onCommit, textarea, view } = setup("");

    fireEvent.change(textarea, { target: { value: "typed" } });
    view.unmount();

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("typed");
  });

  it("saves an unblurred draft when the page is hidden", () => {
    const { onCommit, textarea } = setup("");

    fireEvent.change(textarea, { target: { value: "typed" } });
    fireEvent(window, new Event("pagehide"));

    expect(onCommit).toHaveBeenCalledExactlyOnceWith("typed");
  });

  it("does not save the same draft twice while a save is in flight", () => {
    const onCommit = vi.fn((_value: string) => new Promise<boolean>(() => {}));
    const view = render(<TemplateTextarea value="" onCommit={onCommit} rows={3} placeholder="Comment" />);
    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>("Comment");

    fireEvent.change(textarea, { target: { value: "typed" } });
    fireEvent.blur(textarea);
    view.unmount();

    expect(onCommit).toHaveBeenCalledOnce();
  });

  it("keeps the draft when a blur during an in-flight save is followed by a failure", async () => {
    const save: { finish?: (saved: boolean) => void } = {};
    const onCommit = vi.fn((_value: string) => new Promise<boolean>((resolve) => (save.finish = resolve)));
    const view = render(<TemplateTextarea value="" onCommit={onCommit} rows={3} placeholder="Comment" />);
    const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>("Comment");

    fireEvent.change(textarea, { target: { value: "typed" } });
    fireEvent.blur(textarea);
    // the store applies the save optimistically
    view.rerender(<TemplateTextarea value="typed" onCommit={onCommit} rows={3} placeholder="Comment" />);
    fireEvent.blur(textarea);
    // the save fails and the store rolls back
    await act(async () => save.finish?.(false));
    view.rerender(<TemplateTextarea value="" onCommit={onCommit} rows={3} placeholder="Comment" />);

    expect(textarea.value).toBe("typed");
  });
});
