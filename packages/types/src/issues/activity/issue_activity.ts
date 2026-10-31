/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ApiSchema } from "@plane/api-types";

export type TIssueActivity = ApiSchema<"IssueActivity">;

export type TIssueActivityMap = {
  [issue_id: string]: TIssueActivity;
};

export type TIssueActivityIdMap = {
  [issue_id: string]: string[];
};
