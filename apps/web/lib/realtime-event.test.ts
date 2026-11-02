// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { parseRealtimePageEvent } from "./realtime-event";

const message = (action: string, data: object) =>
  JSON.stringify({ action, data, affectedPages: { currentPage: "p1", parentPage: null, descendantPages: ["p2"] } });

describe("parseRealtimePageEvent", () => {
  it("leaves bare event names and other messages alone", () => {
    expect(parseRealtimePageEvent("locked")).toBeNull();
    expect(parseRealtimePageEvent('{"type":"force_close","code":4000}')).toBeNull();
    expect(parseRealtimePageEvent("{broken")).toBeNull();
  });

  it("keeps only the save details of a property update, for the current page", () => {
    expect(
      parseRealtimePageEvent(message("property_updated", { updated_by: "u", name: "x", is_locked: true }))
    ).toEqual({ pageId: "p1", action: "property_updated", data: { updated_by: "u" } });
  });

  it("drops the server's text from an error event", () => {
    expect(
      parseRealtimePageEvent(message("error", { error_type: "store", error_code: "page_locked", error_message: "x" }))
    ).toEqual({
      pageId: "p1",
      action: "error",
      data: { error_message: "", error_type: "store", error_code: "page_locked" },
    });
  });
});
