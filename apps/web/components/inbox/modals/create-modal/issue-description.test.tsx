// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import type { EditorRefApi } from "@plane/editor";
import { describe, expect, it, vi } from "vitest";
import { InboxIssueDescription } from "./issue-description";

// another intake item's details are loading while the create modal is open
vi.mock("@/hooks/store/use-project-inbox", () => ({ useProjectInbox: () => ({ loader: "issue-loading" }) }));
vi.mock("@/hooks/store/use-editor-asset", () => ({
  useEditorAsset: () => ({ uploadEditorAsset: vi.fn(), duplicateEditorAsset: vi.fn() }),
}));
vi.mock("@/hooks/use-platform-os", () => ({ usePlatformOS: () => ({ isMobile: false }) }));
vi.mock("@/components/editor/rich-text/editor", () => ({ RichTextEditor: () => <div data-testid="editor" /> }));

describe("InboxIssueDescription", () => {
  it("renders the editor while another intake item is loading", () => {
    render(
      <InboxIssueDescription
        workspaceSlug="ws"
        projectId="p1"
        workspaceId="w1"
        data={{}}
        handleData={() => {}}
        editorRef={createRef<EditorRefApi>()}
      />
    );
    expect(screen.getByTestId("editor")).toBeTruthy();
  });
});
