/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { StateGroupIcon } from "@plane/blocks/icons";
// components
import { SingleProgressStats } from "@/components/core/sidebar/single-progress-stats";
import { isStateGroup } from "@/helpers/narrow.helper";

export type TStateGroupData = {
  state: string | undefined;
  completed: number;
  total: number;
}[];

type TStateGroupStatComponent = {
  selectedStateGroups: string[];
  handleStateGroupFiltersUpdate: (stateGroup: string | undefined) => void;
  distribution: TStateGroupData;
  totalIssuesCount: number;
  isEditable?: boolean;
};

export const StateGroupStatComponent = observer(function StateGroupStatComponent(props: TStateGroupStatComponent) {
  const { distribution, isEditable, totalIssuesCount, selectedStateGroups, handleStateGroupFiltersUpdate } = props;

  const selectedStateGroupSet = new Set(selectedStateGroups);

  return (
    <div>
      {distribution.map((group) => (
        <SingleProgressStats
          key={group.state ?? ""}
          title={
            <div className="flex items-center gap-2">
              <StateGroupIcon stateGroup={isStateGroup(group.state) ? group.state : "unstarted"} />
              <span className="text-11 capitalize">{group.state}</span>
            </div>
          }
          completed={group.completed}
          total={totalIssuesCount}
          {...(isEditable && {
            onClick: () => group.state && handleStateGroupFiltersUpdate(group.state),
            selected: group.state ? selectedStateGroupSet.has(group.state) : false,
          })}
        />
      ))}
    </div>
  );
});
