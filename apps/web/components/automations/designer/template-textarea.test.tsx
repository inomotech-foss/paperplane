// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TemplateTextarea } from "./template-textarea";

const setup = (value: string) => {
  const onCommit = vi.fn();
  const view = render(<TemplateTextarea value={value} onCommit={onCommit} rows={3} placeholder="Comment" />);
  const textarea = screen.getByPlaceholderText<HTMLTextAreaElement>("Comment");
  return { onCommit, view, textarea };
};

describe("TemplateTextarea", () => {
  it("saves once on blur, not on every keystroke", () => {
    const { onCommit, textarea } = setup("");

    fireEvent.change(textarea, { target: { value: "a <" } });
    fireEvent.change(textarea, { target: { value: "a <b>{{ work_item.name }}</b>" } });
    expect(onCommit).not.toHaveBeenCalled();
    expect(textarea.value).toBe("a <b>{{ work_item.name }}</b>");

    fireEvent.blur(textarea);
    expect(onCommit).toHaveBeenCalledExactlyOnceWith("a <b>{{ work_item.name }}</b>");
  });

  it("does not save an unchanged template", () => {
    const { onCommit, textarea } = setup('<p><a href="{{ work_item.url }}" rel="noopener noreferrer">link</a></p>');

    fireEvent.change(textarea, { target: { value: textarea.value } });
    fireEvent.blur(textarea);

    expect(onCommit).not.toHaveBeenCalled();
  });

  it("shows the saved template once the server returns it", () => {
    const { onCommit, view, textarea } = setup("");

    fireEvent.change(textarea, { target: { value: "a & b" } });
    fireEvent.blur(textarea);
    view.rerender(<TemplateTextarea value={"a &amp; b"} onCommit={onCommit} rows={3} placeholder="Comment" />);

    expect(textarea.value).toBe("a &amp; b");
  });
});
