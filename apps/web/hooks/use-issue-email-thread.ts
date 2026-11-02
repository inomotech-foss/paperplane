/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import type { TIssueEmailThread } from "@plane/types";
// hooks
import { useUserPermissions } from "@/hooks/store/user";
// services
import { ServiceDeskService } from "@/services/service-desk.service";

const serviceDeskService = new ServiceDeskService();

/**
 * Fetches the service-desk email thread of a work item. The thread is null when the work item
 * was not created from an inbound email. Guests cannot see threads, so they never fetch.
 */
export const useIssueEmailThread = (
  workspaceSlug: string | undefined,
  projectId: string | undefined,
  issueId: string | undefined
) => {
  const { allowPermissions } = useUserPermissions();
  const shouldFetch =
    !!workspaceSlug &&
    !!projectId &&
    !!issueId &&
    allowPermissions(
      [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
      EUserPermissionsLevel.PROJECT,
      workspaceSlug,
      projectId
    );

  const { data, isLoading, mutate } = useSWR<TIssueEmailThread | null>(
    shouldFetch ? `ISSUE_EMAIL_THREAD_${workspaceSlug}_${projectId}_${issueId}` : null,
    shouldFetch ? () => serviceDeskService.getEmailThread(workspaceSlug, projectId, issueId) : null,
    { revalidateOnFocus: false }
  );

  return {
    emailThread: data ?? null,
    isLoading,
    mutate,
  };
};
