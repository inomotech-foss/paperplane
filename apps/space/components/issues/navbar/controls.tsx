/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import { useRouter, useSearchParams } from "next/navigation";
// components
import { IssueFiltersDropdown } from "@/components/issues/filters";
// helpers
import { filtersFromQuery, ISSUE_LAYOUTS } from "@/helpers/filter.helper";
import { queryParamGenerator } from "@/helpers/query-param-generator";
// hooks
import { useIssueDetails } from "@/hooks/store/use-issue-details";
import { useIssueFilter } from "@/hooks/store/use-issue-filter";
import useIsInIframe from "@/hooks/use-is-in-iframe";
// store
import type { PublishStore } from "@/store/publish/publish.store";
// types
import type { TIssueFilters, TIssueLayout } from "@/types/issue";
// local imports
import { IssuesLayoutSelection } from "./layout-selection";
import { NavbarTheme } from "./theme";
import { UserAvatar } from "./user-avatar";

export type NavbarControlsProps = {
  publishSettings: PublishStore;
};

export const NavbarControls = observer(function NavbarControls(props: NavbarControlsProps) {
  // props
  const { publishSettings } = props;
  // router
  const router = useRouter();
  const searchParams = useSearchParams();
  // query params
  const board = searchParams.get("board") || undefined;
  const labels = searchParams.get("labels") || undefined;
  const state = searchParams.get("state") || undefined;
  const priority = searchParams.get("priority") || undefined;
  const peekId = searchParams.get("peekId") || undefined;
  // hooks
  const { getIssueFilters, isIssueFiltersUpdated, initIssueFilters } = useIssueFilter();
  const { setPeekId } = useIssueDetails();
  // derived values
  const { anchor, view_props, workspace_detail } = publishSettings;
  const issueFilters = anchor ? getIssueFilters(anchor) : undefined;
  const activeLayout = issueFilters?.display_filters?.layout || undefined;

  const isInIframe = useIsInIframe();

  useEffect(() => {
    if (anchor && workspace_detail) {
      const viewsAcceptable = ISSUE_LAYOUTS.filter((layout) => view_props?.[layout]);
      const currentBoard: TIssueLayout | undefined =
        viewsAcceptable.find((layout) => layout === board) ?? viewsAcceptable[0];

      if (currentBoard) {
        if (activeLayout === undefined || activeLayout !== currentBoard) {
          const { queryParam } = queryParamGenerator({ board: currentBoard, peekId, priority, state, labels });
          const params: TIssueFilters = {
            display_filters: { layout: currentBoard },
            filters: filtersFromQuery({ priority, state, labels }),
          };

          if (!isIssueFiltersUpdated(anchor, params)) {
            initIssueFilters(anchor, params);
            router.push(`/issues/${anchor}?${queryParam}`);
          }
        }
      }
    }
  }, [
    anchor,
    board,
    labels,
    state,
    priority,
    peekId,
    activeLayout,
    router,
    initIssueFilters,
    setPeekId,
    isIssueFiltersUpdated,
    view_props,
    workspace_detail,
  ]);

  if (!anchor) return null;

  return (
    <>
      {/* issue views */}
      <div className="shrink-0">
        <IssuesLayoutSelection anchor={anchor} />
      </div>

      {/* issue filters */}
      <div className="shrink-0">
        <IssueFiltersDropdown anchor={anchor} />
      </div>

      {/* theming */}
      <div className="shrink-0">
        <NavbarTheme />
      </div>

      {!isInIframe && <UserAvatar />}
    </>
  );
});
