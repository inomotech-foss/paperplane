// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { EFileAssetType } from "@plane/types";
import { getUploadedAssetUrl, parseUnsplashImages, toEntityType } from "./file.service";

vi.mock("@/services/api-client", () => ({ apiClient: {} }));

const photo = { id: "p1", alt_description: "sea", urls: { regular: "r", small: "s", full: "f" }, likes: 3 };

describe("parseUnsplashImages", () => {
  it("reads a search and a photo list and drops malformed photos", () => {
    expect(parseUnsplashImages({ total: 1, results: [photo, { id: "x" }] })).toEqual([
      { id: "p1", alt_description: "sea", urls: { regular: "r", small: "s" } },
    ]);
    expect(parseUnsplashImages([{ ...photo, alt_description: null }])).toEqual([
      { id: "p1", alt_description: undefined, urls: { regular: "r", small: "s" } },
    ]);
    expect(parseUnsplashImages({ errors: ["rate limited"] })).toEqual([]);
  });
});

describe("toEntityType", () => {
  it("keeps the types the API stores and rejects the others", () => {
    expect(toEntityType(EFileAssetType.USER_AVATAR)).toBe("USER_AVATAR");
    expect(() => toEntityType(EFileAssetType.TEAM_SPACE_DESCRIPTION)).toThrow();
  });
});

describe("getUploadedAssetUrl", () => {
  it("requires a URL", () => {
    const upload = { asset_id: "a", upload_data: { url: "u", fields: {} } };
    expect(getUploadedAssetUrl({ ...upload, asset_url: "/x/" })).toBe("/x/");
    expect(() => getUploadedAssetUrl({ ...upload, asset_url: null })).toThrow();
  });
});
