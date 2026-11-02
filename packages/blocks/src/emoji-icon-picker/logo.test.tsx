/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Logo } from "./logo";

describe("Logo", () => {
  it("shows a default icon when no logo is set", () => {
    const { container } = render(<Logo logo={{ in_use: "emoji" }} size={14} />);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders a set emoji", () => {
    const { container } = render(<Logo logo={{ in_use: "emoji", emoji: { value: "128512" } }} />);
    expect(container.textContent).toBe(String.fromCodePoint(128512));
  });
});
