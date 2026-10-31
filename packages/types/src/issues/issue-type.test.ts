// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { DEFAULT_LOGO_PROPS } from "../client-json/logo-props";
import { parseIssueType } from "./issue-type";

const apiType = {
  id: "t1",
  created_at: "",
  updated_at: "",
  deleted_at: null,
  name: "Bug",
  description: "",
  is_active: true,
  level: 0,
  external_source: null,
  external_id: null,
  created_by: null,
  updated_by: null,
  workspace: "w1",
};

describe("parseIssueType", () => {
  it("parses the logo and keeps the other fields", () => {
    const logo = { in_use: "icon", icon: { name: "bug", color: "#f00" } };
    expect(parseIssueType({ ...apiType, logo_props: logo })).toMatchObject({ name: "Bug", logo_props: logo });
  });

  it("falls back to the default logo", () => {
    expect(parseIssueType({ ...apiType, logo_props: {} }).logo_props).toEqual(DEFAULT_LOGO_PROPS);
  });
});
