/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IIssueFilters } from "@plane/types";

/** The PQL expression currently applied to a list, empty for none. */
export const appliedQuery = (filters: IIssueFilters | undefined): string => filters?.displayFilters?.pql ?? "";
