// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { act, render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TCommentsOperations } from "@plane/types";
import { CommentCreate } from "./comment-create";

type TEditorProps = {
  onChange: (json: object, html: string) => void;
  uploadFile: (blockId: string, file: File) => Promise<string>;
  onEnterKeyPress: (event: { preventDefault: () => void }) => void;
};

const editor = vi.hoisted((): { props?: TEditorProps } => ({}));
const bulkUpdate = vi.hoisted(() => vi.fn());

vi.mock("@/components/editor/lite-text", () => ({
  LiteTextEditor: (props: TEditorProps) => {
    editor.props = props;
    return null;
  },
}));
vi.mock("@/hooks/store/use-workspace", () => ({ useWorkspace: () => ({ getWorkspaceBySlug: () => undefined }) }));
vi.mock("@/services/file.service", () => ({
  FileService: class {
    updateBulkProjectAssetsUploadStatus = bulkUpdate;
  },
}));

const operations: TCommentsOperations = {
  copyCommentLink: vi.fn(),
  createComment: vi.fn(async () => ({ id: "comment-1" })),
  updateComment: vi.fn(async () => {}),
  removeComment: vi.fn(async () => {}),
  uploadCommentAsset: vi.fn(async () => ({
    asset_id: "asset-1",
    asset_url: null,
    upload_data: { url: "", fields: {} },
  })),
  duplicateCommentAsset: vi.fn(async () => ({ asset_id: "asset-2" })),
  addCommentReaction: vi.fn(async () => {}),
  deleteCommentReaction: vi.fn(async () => {}),
  react: vi.fn(async () => {}),
  reactionIds: vi.fn(() => undefined),
  userReactions: vi.fn(() => undefined),
  getReactionUsers: vi.fn(() => ""),
};

function editorProps(): TEditorProps {
  if (!editor.props) throw new Error("editor not rendered");
  return editor.props;
}

describe("CommentCreate", () => {
  it("associates uploaded images with the new comment", async () => {
    render(<CommentCreate workspaceSlug="ws" projectId="p1" entityId="issue-1" activityOperations={operations} />);
    await act(async () => {
      editorProps().onChange({}, "<p>hi</p>");
      await editorProps().uploadFile("block-1", new File(["x"], "x.png"));
    });
    await act(async () => {
      editorProps().onEnterKeyPress({ preventDefault: () => {} });
    });

    await vi.waitFor(() =>
      expect(bulkUpdate).toHaveBeenCalledWith("ws", "p1", "comment-1", { asset_ids: ["asset-1"] })
    );
  });
});
