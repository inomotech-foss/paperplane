// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { userUpdateBody } from "./user.service";

describe("userUpdateBody", () => {
  it("keeps the writable fields and drops the read-only ones", () => {
    const body = userUpdateBody({ first_name: "A", avatar_url: "", user_timezone: "UTC", email: "a@b.c" });
    expect(JSON.parse(JSON.stringify(body))).toEqual({ first_name: "A", user_timezone: "UTC" });
  });

  it("keeps a null cover image, which clears it", () => {
    expect(userUpdateBody({ cover_image: null, cover_image_asset: null })).toMatchObject({
      cover_image: null,
      cover_image_asset: null,
    });
  });
});
