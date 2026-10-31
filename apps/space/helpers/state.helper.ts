/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { STATE_GROUPS } from "@plane/constants";
import type { TStateGroups } from "@plane/types";
import type { TPublicStateResponse } from "@/services/project.service";
import { isStateGroup } from "./narrow.helper";

export type TPublicState = Omit<TPublicStateResponse, "group"> & { group: TStateGroups };

/** Narrows the state group. An unknown group falls back to backlog. */
export const toPublicState = (state: TPublicStateResponse): TPublicState => ({
  ...state,
  group: isStateGroup(state.group) ? state.group : "backlog",
});

export const sortStates = (states: TPublicState[]) => {
  if (!states || states.length === 0) return;

  return states.sort((stateA, stateB) => {
    if (stateA.group === stateB.group) {
      return stateA.sequence - stateB.sequence;
    }
    return Object.keys(STATE_GROUPS).indexOf(stateA.group) - Object.keys(STATE_GROUPS).indexOf(stateB.group);
  });
};
