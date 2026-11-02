// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWorkItemCommentOperations } from "./helper";

const setToast = vi.hoisted(() => vi.fn());
const uploadEditorAsset = vi.hoisted(() => vi.fn(async () => Promise.reject(new Error("413"))));

vi.mock("@plane/blocks/toast", () => ({ setToast }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@/hooks/store/use-editor-asset", () => ({
  useEditorAsset: () => ({ uploadEditorAsset, duplicateEditorAsset: vi.fn() }),
}));
vi.mock("@/hooks/store/use-issue-detail", () => ({
  useIssueDetail: () => ({
    commentReaction: {},
    issue: { getIssueById: () => undefined },
  }),
}));
vi.mock("@/hooks/store/use-member", () => ({ useMember: () => ({ getUserDetails: () => undefined }) }));
vi.mock("@/hooks/store/use-project", () => ({ useProject: () => ({ getProjectById: () => undefined }) }));
vi.mock("@/hooks/store/user", () => ({ useUser: () => ({ data: undefined }) }));

describe("useWorkItemCommentOperations", () => {
  it("tells the user when a comment image upload fails", async () => {
    const { result } = renderHook(() => useWorkItemCommentOperations("ws", "p1", "i1"));
    await expect(result.current.uploadCommentAsset("b1", new File([""], "a.png"))).rejects.toThrow(
      "issue.comments.upload.error"
    );
    expect(setToast).toHaveBeenCalledWith(expect.objectContaining({ type: "error" }));
  });
});
