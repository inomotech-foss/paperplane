/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// plane imports
import type { TIssueEmailThread } from "@plane/types";
// services
import { ServiceDeskService } from "@/services/service-desk.service";

const serviceDeskService = new ServiceDeskService();

/**
 * Fetches the service-desk email thread of a work item, if it has one.
 * The endpoint returns 404 for work items that were not created from an
 * inbound email, so any fetch error is treated as "no email thread" (null).
 */
export const useIssueEmailThread = (
  workspaceSlug: string | undefined,
  projectId: string | undefined,
  issueId: string | undefined
) => {
  const shouldFetch = !!workspaceSlug && !!projectId && !!issueId;

  const { data, isLoading, mutate } = useSWR<TIssueEmailThread | null>(
    shouldFetch ? `ISSUE_EMAIL_THREAD_${workspaceSlug}_${projectId}_${issueId}` : null,
    shouldFetch ? () => serviceDeskService.getEmailThread(workspaceSlug, projectId, issueId).catch(() => null) : null,
    {
      revalidateOnFocus: false,
      shouldRetryOnError: false,
    }
  );

  return {
    emailThread: data ?? null,
    isLoading,
    mutate,
  };
};
