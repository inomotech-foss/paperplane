/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ISSUE_PRIORITIES, STATE_GROUPS } from "@plane/constants";
import { isOneOf } from "@plane/types";
import type { TIssuePriorities, TStateGroups } from "@plane/types";

const PRIORITY_KEYS = ISSUE_PRIORITIES.map((priority) => priority.key);
const STATE_GROUP_KEYS = Object.values(STATE_GROUPS).map((group) => group.key);

export const isIssuePriority = (value: unknown): value is TIssuePriorities => isOneOf(PRIORITY_KEYS, value);

export const isStateGroup = (value: unknown): value is TStateGroups => isOneOf(STATE_GROUP_KEYS, value);
