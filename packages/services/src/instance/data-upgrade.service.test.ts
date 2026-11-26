// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it } from "vitest";
import { formatDataUpgradeCounts, hasActiveDataUpgrade } from "./data-upgrade.service";
import type { TDataUpgrade, TDataUpgradeStatus } from "./data-upgrade.service";

const upgrade = (status: TDataUpgradeStatus): TDataUpgrade => ({
  name: `upgrade-${status}`,
  description: "",
  status,
  counts: {},
  error: "",
  attempts: 0,
  started_at: null,
  finished_at: null,
  updated_at: null,
});

describe("hasActiveDataUpgrade", () => {
  it("is true while an upgrade is running", () => {
    expect(hasActiveDataUpgrade([upgrade("done"), upgrade("running"), upgrade("pending")])).toBe(true);
    expect(hasActiveDataUpgrade([upgrade("running"), upgrade("failed")])).toBe(true);
  });

  it("is true while an upgrade is pending and none failed", () => {
    expect(hasActiveDataUpgrade([upgrade("done"), upgrade("pending")])).toBe(true);
  });

  it("is false when the pending upgrades wait behind a failed one", () => {
    expect(hasActiveDataUpgrade([upgrade("done"), upgrade("failed"), upgrade("pending")])).toBe(false);
  });

  it("is false once every upgrade is done or failed", () => {
    expect(hasActiveDataUpgrade([upgrade("done"), upgrade("failed")])).toBe(false);
    expect(hasActiveDataUpgrade([])).toBe(false);
    expect(hasActiveDataUpgrade(undefined)).toBe(false);
  });
});

describe("formatDataUpgradeCounts", () => {
  it("lists the counts in the order the API sends them", () => {
    expect(formatDataUpgradeCounts({ rewritten: 274, unchanged: 80 })).toBe("rewritten 274, unchanged 80");
  });

  it("spells out underscores and groups thousands", () => {
    expect(formatDataUpgradeCounts({ pages_scanned: 12345 })).toBe("pages scanned 12,345");
  });

  it("is empty without counts", () => {
    expect(formatDataUpgradeCounts({})).toBe("");
  });
});
