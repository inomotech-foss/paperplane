// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { ApiError } from "../client";
import { instanceUserError } from "./user-error";

const apiError = (body: unknown) => new ApiError(new Response(null, { status: 400 }), body);

describe("instanceUserError", () => {
  it("keeps the message and the owned workspaces", () => {
    expect(instanceUserError(apiError({ error: "owns workspaces", owned_workspaces: ["a", 1, "b"] }))).toEqual({
      error: "owns workspaces",
      owned_workspaces: ["a", "b"],
    });
  });

  it("returns only the message without owned workspaces", () => {
    expect(instanceUserError(apiError({ error: "nope" }))).toEqual({ error: "nope" });
  });

  it("returns undefined without a message or for other errors", () => {
    expect(instanceUserError(apiError({ detail: "x" }))).toBeUndefined();
    expect(instanceUserError(new Error("network"))).toBeUndefined();
    expect(instanceUserError(undefined)).toBeUndefined();
  });
});
