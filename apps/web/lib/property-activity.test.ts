// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { describePropertyChange } from "./property-activity";

const names: Record<string, string> = { size: "Size", bugSize: "Bug size" };
const nameOf = (id: string | undefined) => (id && names[id]) || "a custom property";

describe("describePropertyChange", () => {
  it("reads a manual change of one property", () => {
    expect(
      describePropertyChange(
        { old_identifier: "size", new_identifier: "size", old_value: "XL", new_value: "L" },
        nameOf
      )
    ).toEqual({ kind: "set", property: "Size", value: "L" });
    expect(
      describePropertyChange(
        { old_identifier: "size", new_identifier: "size", old_value: "XL", new_value: undefined },
        nameOf
      )
    ).toEqual({ kind: "cleared", property: "Size" });
  });

  it("reads a value a type change moved or removed", () => {
    expect(
      describePropertyChange(
        { old_identifier: "size", new_identifier: "bugSize", old_value: "XL", new_value: "XL" },
        nameOf
      )
    ).toEqual({ kind: "moved", from: "Size", to: "Bug size", value: "XL" });
    expect(
      describePropertyChange(
        { old_identifier: "gone", new_identifier: undefined, old_value: "XL", new_value: undefined },
        nameOf
      )
    ).toEqual({ kind: "removed", property: "a custom property", value: "XL" });
  });
});
