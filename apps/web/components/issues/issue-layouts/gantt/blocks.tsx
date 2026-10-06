/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { ChevronRightOutline } from "@makeplane/propel/icons";
import { Logo } from "@plane/blocks/emoji-icon-picker";
import { ControlLink } from "@plane/blocks/layout";
import { Spinner } from "@plane/blocks/spinner";
import { useTranslation } from "@plane/i18n";
import { GANTT_TIMELINE_TYPE } from "@plane/types";
import { cn, generateWorkItemLink, renderFormattedDate } from "@plane/utils";
// components
import { SIDEBAR_WIDTH } from "@/components/gantt-chart/constants";
import { isBlockRolledUp } from "@/components/gantt-chart/views/helpers";
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useIssueTypes } from "@/hooks/store/use-issue-types";
import { useIssues } from "@/hooks/store/use-issues";
import { useProject } from "@/hooks/store/use-project";
import { useProjectState } from "@/hooks/store/use-project-state";
import { useIssueStoreType } from "@/hooks/use-issue-layout-store";
import useIssuePeekOverviewRedirection from "@/hooks/use-issue-peek-overview-redirection";
import { usePlatformOS } from "@/hooks/use-platform-os";
import { useChartPalette } from "@/hooks/use-chart-palette";
import { useTimeLineChart } from "@/hooks/use-timeline-chart";
// local imports
import { WorkItemPreviewCard } from "../../preview-card";
import { getBlockViewDetails } from "../utils";
import { getBarColor } from "./bar-color";
import type { GanttStoreType } from "./base-gantt-root";
import type { TGanttRowState } from "./hierarchy-context";
import { useGanttHierarchy } from "./hierarchy-context";

type Props = {
  issueId: string;
  isEpic?: boolean;
};

// Resolve the work item type to show for an issue — its explicit type, else
// the project's default — mirroring IssueTypeDropdown's display behavior.
// Returns null when the project has no work item types configured.
const useResolvedIssueType = (issue: ReturnType<ReturnType<typeof useIssueDetail>["issue"]["getIssueById"]>) => {
  const { getIssueTypeById, getProjectDefaultIssueType } = useIssueTypes();
  return getIssueTypeById(issue?.type_id) ?? getProjectDefaultIssueType(issue?.project_id);
};

export const IssueGanttBlock = observer(function IssueGanttBlock(props: Props) {
  const { issueId, isEpic } = props;
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const { getProjectStates } = useProjectState();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getProjectIdentifierById } = useProject();
  const storeType = useIssueStoreType() as GanttStoreType;
  const { issuesFilter } = useIssues(storeType);
  // hooks
  const { isMobile } = usePlatformOS();
  const chartPalette = useChartPalette();
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);
  const { getBlockById } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  const { t } = useTranslation();

  // derived values
  const issueDetails = getIssueById(issueId);
  const issueType = useResolvedIssueType(issueDetails);
  const block = getBlockById(issueId);
  const isRolledUp = isBlockRolledUp(block);
  const stateDetails =
    issueDetails && getProjectStates(issueDetails?.project_id)?.find((state) => state?.id == issueDetails?.state_id);

  const barColor = getBarColor({
    colorBy: issuesFilter.issueFilters?.displayFilters?.color_by,
    stateColor: stateDetails?.color,
    projectIdentifier: getProjectIdentifierById(issueDetails?.project_id),
    sequenceId: issueDetails?.sequence_id,
    palette: chartPalette,
  });

  const { blockStyle } = getBlockViewDetails(issueDetails, barColor ?? "");

  const handleIssuePeekOverview = () => handleRedirection(workspaceSlug, issueDetails, isMobile);

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={100}
        render={
          // oxlint-disable-next-line jsx_a11y/click-events-have-key-events oxlint-disable-next-line jsx_a11y/no-static-element-interactions
          <div
            id={`issue-${issueId}`}
            className="space-between relative flex h-full w-full cursor-pointer items-center rounded-sm"
            style={blockStyle}
            onClick={handleIssuePeekOverview}
          >
            <div className="absolute top-0 left-0 h-full w-full bg-surface-1/50" />
            {isRolledUp && (
              // hatched like a rolled-up bar in project plans: the dates come from the work items below
              <div
                aria-hidden
                className="absolute top-0 left-0 h-full w-full rounded-sm border border-dashed border-strong"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, transparent 0 5px, rgba(128, 128, 128, 0.28) 5px 10px)",
                }}
              />
            )}
            <div
              className="sticky flex w-auto flex-1 items-center gap-1.5 overflow-hidden px-2.5 py-1 text-13 text-primary"
              style={{ left: `${SIDEBAR_WIDTH}px` }}
            >
              {issueType && (
                <span className="flex flex-shrink-0 items-center">
                  <Logo logo={issueType.logo_props} size={12} />
                </span>
              )}
              <span className="truncate">{issueDetails?.name}</span>
            </div>
          </div>
        }
      />
      <PopoverContent side="bottom" align="start" sideOffset={8}>
        {issueDetails && issueDetails?.project_id && (
          <WorkItemPreviewCard
            projectId={issueDetails.project_id}
            stateDetails={{
              id: issueDetails.state_id ?? undefined,
            }}
            workItem={issueDetails}
            footer={
              isRolledUp && block?.rollup ? (
                <>
                  <p>{t("timeline_hierarchy.rolled_up_bar", { count: block.rollup.descendants_count })}</p>
                  <p className="text-tertiary">
                    {renderFormattedDate(block.rollup.start_date ?? block.rollup.target_date)} –{" "}
                    {renderFormattedDate(block.rollup.target_date ?? block.rollup.start_date)}
                  </p>
                </>
              ) : undefined
            }
          />
        )}
      </PopoverContent>
    </Popover>
  );
});

/**
 * How deep a sidebar row is indented: from the timeline's tree, else the number of
 * ancestors that are themselves in the chart (the block list is hierarchy-ordered).
 */
const useNestingDepth = (issueId: string, rowState: TGanttRowState | undefined) => {
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { getBlockById } = useTimeLineChart(GANTT_TIMELINE_TYPE.ISSUE);
  if (rowState) return rowState.depth;
  let depth = 0;
  const seenIds = new Set([issueId]);
  let parentId = getIssueById(issueId)?.parent_id;
  while (parentId && !seenIds.has(parentId) && getBlockById(parentId)) {
    depth += 1;
    seenIds.add(parentId);
    parentId = getIssueById(parentId)?.parent_id;
  }
  return depth;
};

type TGanttRowToggleProps = {
  rowState: TGanttRowState | undefined;
  onToggle: () => void;
};

/** The chevron that folds and unfolds a row, or a spinner while its children load. */
const GanttRowToggle = observer(function GanttRowToggle(props: TGanttRowToggleProps) {
  const { rowState, onToggle } = props;
  const { t } = useTranslation();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggle();
  };

  let content: React.ReactNode = null;
  if (rowState?.isLoading) content = <Spinner height="12px" width="12px" />;
  else if (rowState?.hasChildren)
    content = (
      <button
        type="button"
        className="grid size-4 place-items-center rounded-xs text-placeholder hover:text-tertiary"
        onClick={handleClick}
        aria-expanded={rowState.isExpanded}
        aria-label={t(rowState.isExpanded ? "timeline_hierarchy.collapse" : "timeline_hierarchy.expand")}
      >
        <ChevronRightOutline
          className={cn("size-4 transition-transform", { "rotate-90": rowState.isExpanded })}
          strokeWidth={2.5}
        />
      </button>
    );

  return <span className="grid size-4 flex-shrink-0 place-items-center">{content}</span>;
});

// rendering issues on gantt sidebar
export const IssueGanttSidebarBlock = observer(function IssueGanttSidebarBlock(props: Props) {
  const { issueId, isEpic = false } = props;
  // router
  const { workspaceSlug: routerWorkspaceSlug } = useParams();
  const workspaceSlug = routerWorkspaceSlug?.toString();
  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { isMobile } = usePlatformOS();
  const storeType = useIssueStoreType() as GanttStoreType;
  const { issuesFilter } = useIssues(storeType);
  const { getProjectIdentifierById } = useProject();

  // handlers
  const { handleRedirection } = useIssuePeekOverviewRedirection(isEpic);

  const hierarchy = useGanttHierarchy();
  const { t } = useTranslation();

  // derived values
  const issueDetails = getIssueById(issueId);
  const issueType = useResolvedIssueType(issueDetails);
  const projectIdentifier = getProjectIdentifierById(issueDetails?.project_id);
  const rowState = hierarchy?.getRowState(issueId);

  const nestingDepth = useNestingDepth(issueId, rowState);

  const handleIssuePeekOverview = (e: any) => {
    e.stopPropagation(true);
    e.preventDefault();
    handleRedirection(workspaceSlug, issueDetails, isMobile);
  };

  const workItemLink = generateWorkItemLink({
    workspaceSlug,
    projectId: issueDetails?.project_id,
    issueId,
    projectIdentifier,
    sequenceId: issueDetails?.sequence_id,
    isEpic,
  });

  return (
    <ControlLink
      id={`issue-${issueId}`}
      href={workItemLink}
      onClick={handleIssuePeekOverview}
      className="line-clamp-1 w-full cursor-pointer text-13 text-primary"
      disabled={!!issueDetails?.tempId}
    >
      <div className="relative flex h-full w-full cursor-pointer items-center gap-2">
        {nestingDepth > 0 && <span aria-hidden className="flex-shrink-0" style={{ width: `${nestingDepth * 16}px` }} />}
        {hierarchy && <GanttRowToggle rowState={rowState} onToggle={() => hierarchy.toggleRow(issueId)} />}
        {issueDetails?.project_id && (
          <IssueIdentifier
            issueId={issueDetails.id}
            projectId={issueDetails.project_id}
            size="xs"
            variant="tertiary"
            displayProperties={issuesFilter?.issueFilters?.displayProperties}
          />
        )}
        {issueType && (
          <span className="flex flex-shrink-0 items-center">
            <Logo logo={issueType.logo_props} size={14} />
          </span>
        )}
        <Tooltip label={issueDetails?.name ?? ""} layout="stacked" disabled={isMobile}>
          <span className="flex-grow truncate text-13 font-medium">{issueDetails?.name}</span>
        </Tooltip>
        {!!rowState?.hasChildren && !rowState.isExpanded && rowState.hiddenCount > 0 && (
          <Tooltip label={t("timeline_hierarchy.hidden_children", { count: rowState.hiddenCount })} disabled={isMobile}>
            <span className="flex-shrink-0 rounded-sm bg-layer-2 px-1 text-11 text-tertiary">
              {rowState.hiddenCount}
            </span>
          </Tooltip>
        )}
      </div>
    </ControlLink>
  );
});
