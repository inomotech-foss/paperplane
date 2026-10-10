// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { SlidersHorizontal } from "lucide-react";
import { observer } from "mobx-react";
// hooks
import { useIssueCustomProperties } from "@/hooks/store/use-issue-custom-properties";
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
// lib
import { describePropertyChange } from "@/lib/property-activity";
// local imports
import { IssueActivityBlockComponent } from "./helpers/activity-block";

type TIssuePropertyActivity = { activityId: string; ends: "top" | "bottom" | undefined };

function Value(props: { children: string }) {
  return <span className="font-medium text-primary">{props.children}</span>;
}

export const IssuePropertyActivity = observer(function IssuePropertyActivity(props: TIssuePropertyActivity) {
  const { activityId, ends } = props;
  const {
    activity: { getActivityById },
  } = useIssueDetail();
  const { getPropertyById } = useIssueCustomProperties();

  const activity = getActivityById(activityId);
  if (!activity) return <></>;

  const nameOf = (propertyId: string | undefined) => {
    const property = propertyId ? getPropertyById(propertyId) : null;
    return property?.display_name || property?.name || "a custom property";
  };
  const change = describePropertyChange(activity, nameOf);

  return (
    <IssueActivityBlockComponent
      icon={<SlidersHorizontal className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />}
      activityId={activityId}
      ends={ends}
    >
      {change.kind === "set" && (
        <>
          set <Value>{change.property}</Value> to <Value>{change.value}</Value>.
        </>
      )}
      {change.kind === "cleared" && (
        <>
          cleared <Value>{change.property}</Value>.
        </>
      )}
      {change.kind === "moved" && (
        <>
          moved the value of <Value>{change.from}</Value> to <Value>{change.to}</Value> as <Value>{change.value}</Value>
          .
        </>
      )}
      {change.kind === "removed" && (
        <>
          removed <Value>{change.value}</Value> from <Value>{change.property}</Value> when the type changed.
        </>
      )}
    </IssueActivityBlockComponent>
  );
});
