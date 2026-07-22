/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import uniq from "lodash-es/uniq";
import { Mail } from "lucide-react";
import { observer } from "mobx-react";
// plane package imports
import type { TActivityFilters } from "@plane/constants";
import { E_SORT_ORDER, defaultActivityFilters, EUserPermissions } from "@plane/constants";
import { useLocalStorage } from "@plane/hooks";
// i18n
import { useTranslation } from "@plane/i18n";
import { LockIcon } from "@plane/propel/icons";
//types
import type { TFileSignedURLResponse, TIssueComment } from "@plane/types";
import { cn } from "@plane/utils";
// components
import { CommentCreate } from "@/components/comments/comment-create";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useUser, useUserPermissions } from "@/hooks/store/user";
import { useIssueEmailThread } from "@/hooks/use-issue-email-thread";
// plane web components
import { ActivityFilterRoot } from "@/plane-web/components/issues/worklog/activity/filter-root";
import { IssueActivityWorklogCreateButton } from "@/plane-web/components/issues/worklog/activity/worklog-create-button";
import { IssueActivityCommentRoot } from "./activity-comment-root";
import { EmailReplyCreate } from "./email-reply-create";
import { EmailThreadPanel } from "./email-thread-panel";
import { useWorkItemCommentOperations } from "./helper";
import { ActivitySortRoot } from "./sort-root";

type TIssueActivity = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled?: boolean;
  isIntakeIssue?: boolean;
};

export type TActivityOperations = {
  createComment: (data: Partial<TIssueComment>) => Promise<TIssueComment>;
  updateComment: (commentId: string, data: Partial<TIssueComment>) => Promise<void>;
  removeComment: (commentId: string) => Promise<void>;
  uploadCommentAsset: (blockId: string, file: File, commentId?: string) => Promise<TFileSignedURLResponse>;
};

export const IssueActivity = observer(function IssueActivity(props: TIssueActivity) {
  const { workspaceSlug, projectId, issueId, disabled = false, isIntakeIssue = false } = props;
  // i18n
  const { t } = useTranslation();
  // hooks
  const { setValue: setFilterValue, storedValue: selectedFilters } = useLocalStorage(
    "issue_activity_filters",
    defaultActivityFilters
  );
  const { setValue: setSortOrder, storedValue: sortOrder } = useLocalStorage("activity_sort_order", E_SORT_ORDER.ASC);
  // composer mode - internal comment vs customer email reply (only relevant for service-desk work items)
  const [composerMode, setComposerMode] = useState<"comment" | "email">("comment");
  // store hooks
  const {
    issue: { getIssueById },
  } = useIssueDetail();

  const { getProjectRoleByWorkspaceSlugAndProjectId } = useUserPermissions();
  const { getProjectById } = useProject();
  const { data: currentUser } = useUser();
  // derived values
  const issue = issueId ? getIssueById(issueId) : undefined;
  const currentUserProjectRole = getProjectRoleByWorkspaceSlugAndProjectId(workspaceSlug, projectId);
  const isAdmin = currentUserProjectRole === EUserPermissions.ADMIN;
  const isGuest = currentUserProjectRole === EUserPermissions.GUEST;
  const isAssigned = issue?.assignee_ids && currentUser?.id ? issue?.assignee_ids.includes(currentUser?.id) : false;
  const isWorklogButtonEnabled = !isIntakeIssue && !isGuest && (isAdmin || isAssigned);
  // toggle filter
  const toggleFilter = (filter: TActivityFilters) => {
    if (!selectedFilters) return;
    let _filters = [];
    if (selectedFilters.includes(filter)) {
      if (selectedFilters.length === 1) return selectedFilters; // Ensure at least one filter is applied
      _filters = selectedFilters.filter((f) => f !== filter);
    } else {
      _filters = [...selectedFilters, filter];
    }

    setFilterValue(uniq(_filters));
  };

  const toggleSortOrder = () => {
    setSortOrder(sortOrder === E_SORT_ORDER.ASC ? E_SORT_ORDER.DESC : E_SORT_ORDER.ASC);
  };

  // helper hooks
  const activityOperations = useWorkItemCommentOperations(workspaceSlug, projectId, issueId);
  // service-desk email thread (null when the work item was not created from an inbound email)
  const { emailThread, mutate: mutateEmailThread } = useIssueEmailThread(workspaceSlug, projectId, issueId);

  const project = getProjectById(projectId);
  const renderCommentCreationBox = useMemo(
    () => (
      <div className="space-y-2">
        {emailThread && (
          <div className="flex w-fit items-center gap-0.5 rounded-md border-[0.5px] border-subtle bg-surface-2 p-0.5">
            <button
              type="button"
              onClick={() => setComposerMode("comment")}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-2 py-1 text-11 font-medium transition-colors",
                composerMode === "comment" ? "bg-layer-1 text-primary" : "text-tertiary hover:text-secondary"
              )}
            >
              <LockIcon className="h-3 w-3" />
              Internal comment
            </button>
            <button
              type="button"
              onClick={() => setComposerMode("email")}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-2 py-1 text-11 font-medium transition-colors",
                composerMode === "email" ? "bg-layer-1 text-primary" : "text-tertiary hover:text-secondary"
              )}
            >
              <Mail className="h-3 w-3" />
              Email reply
            </button>
          </div>
        )}
        {emailThread && composerMode === "email" ? (
          <EmailReplyCreate
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            issueId={issueId}
            emailThread={emailThread}
            activityOperations={activityOperations}
            onReplySent={() => mutateEmailThread()}
            showToolbarInitially
          />
        ) : (
          <CommentCreate
            workspaceSlug={workspaceSlug}
            entityId={issueId}
            activityOperations={activityOperations}
            showToolbarInitially
            projectId={projectId}
          />
        )}
      </div>
    ),
    [workspaceSlug, issueId, activityOperations, projectId, emailThread, composerMode, mutateEmailThread]
  );
  if (!project) return <></>;

  return (
    <div className="space-y-4">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="text-h5-medium text-primary">{t("common.activity")}</div>
        <div className="flex items-center gap-2">
          {isWorklogButtonEnabled && (
            <IssueActivityWorklogCreateButton
              workspaceSlug={workspaceSlug}
              projectId={projectId}
              issueId={issueId}
              disabled={disabled}
            />
          )}
          <ActivitySortRoot sortOrder={sortOrder || E_SORT_ORDER.ASC} toggleSort={toggleSortOrder} />
          <ActivityFilterRoot
            selectedFilters={selectedFilters || defaultActivityFilters}
            toggleFilter={toggleFilter}
            isIntakeIssue={isIntakeIssue}
            projectId={projectId}
          />
        </div>
      </div>

      {/* service-desk email thread details */}
      {emailThread && (
        <EmailThreadPanel
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          issueId={issueId}
          emailThread={emailThread}
          mutateEmailThread={mutateEmailThread}
        />
      )}

      {/* rendering activity */}
      <div className="space-y-3">
        <div className="min-h-[200px]">
          <div className="space-y-3">
            {!disabled && sortOrder === E_SORT_ORDER.DESC && renderCommentCreationBox}
            <IssueActivityCommentRoot
              projectId={projectId}
              workspaceSlug={workspaceSlug}
              isIntakeIssue={isIntakeIssue}
              issueId={issueId}
              selectedFilters={selectedFilters || defaultActivityFilters}
              activityOperations={activityOperations}
              showAccessSpecifier={!!project.anchor || !!emailThread}
              disabled={disabled}
              sortOrder={sortOrder || E_SORT_ORDER.ASC}
            />
            {!disabled && sortOrder === E_SORT_ORDER.ASC && renderCommentCreationBox}
          </div>
        </div>
      </div>
    </div>
  );
});
