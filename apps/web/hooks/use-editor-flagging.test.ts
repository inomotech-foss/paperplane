/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { useEditorFlagging } from "./use-editor-flagging";

describe("useEditorFlagging", () => {
  it("keeps collaborator cursors on in the page editor", () => {
    expect(useEditorFlagging({ workspaceSlug: "ws" }).document.disabled).not.toContain("collaboration-cursor");
  });
});
