/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it } from "vitest";
import { EFileAssetType } from "@plane/types";
import { buildUploadForm, toAssetUpload, toEntityType } from "./file.service";
import { serializeQuery } from "./issue.service";
import { parsePublicComment, parsePublicComments } from "./public-comment";

const comment = {
  id: "c1",
  comment_html: "<p>hi</p>",
  created_at: "2026-10-01T10:00:00Z",
  actor_detail: { id: "u1", display_name: "ann", first_name: "Ann", last_name: "", avatar_url: null, is_bot: false },
  comment_reactions: [{ id: "r1", comment: "c1", reaction: "128077", actor_detail: { id: "u2", display_name: "bob" } }],
  access: "EXTERNAL",
};

describe("parsePublicComment", () => {
  it("keeps the fields the app reads and maps a null avatar to undefined", () => {
    const parsed = parsePublicComment(comment);

    expect(parsed.actor_detail).toEqual({
      id: "u1",
      display_name: "ann",
      first_name: "Ann",
      last_name: "",
      avatar_url: undefined,
      is_bot: false,
    });
    expect(parsed.comment_reactions[0].actor_detail?.display_name).toBe("bob");
    expect(parsed).not.toHaveProperty("access");
  });

  it("accepts a deleted actor", () => {
    expect(parsePublicComments([{ ...comment, actor_detail: null }])[0].actor_detail).toBeNull();
  });

  it("rejects a comment without reactions", () => {
    expect(() => parsePublicComment({ ...comment, comment_reactions: undefined })).toThrow();
  });

  it("drops invalid comments and keeps the rest", () => {
    const parsed = parsePublicComments([{ ...comment, id: 1 }, comment, null]);

    expect(parsed.map((item) => item.id)).toEqual(["c1"]);
    expect(parsePublicComments({ results: [] })).toEqual([]);
  });
});

describe("toAssetUpload", () => {
  const upload = {
    asset_id: "a1",
    asset_url: null,
    upload_data: { url: "https://s3", fields: { key: "k", policy: "p" } },
  };

  it("keeps the upload form and builds the form data from it", () => {
    const form = buildUploadForm(toAssetUpload(upload), new File(["x"], "a.txt"));
    expect([...form.keys()]).toEqual(["key", "policy", "file"]);
  });

  it("requires an upload form", () => {
    expect(() => toAssetUpload({ ...upload, upload_data: null })).toThrow();
  });
});

describe("toEntityType", () => {
  it("accepts comment images only", () => {
    expect(toEntityType(EFileAssetType.COMMENT_DESCRIPTION)).toBe("COMMENT_DESCRIPTION");
    expect(() => toEntityType(EFileAssetType.USER_AVATAR)).toThrow();
  });
});

describe("serializeQuery", () => {
  it("skips undefined values and stringifies booleans", () => {
    expect(serializeQuery({ cursor: "50:0:0", per_page: "50", sub_issue: true, labels: undefined })).toBe(
      "cursor=50%3A0%3A0&per_page=50&sub_issue=true"
    );
  });
});
