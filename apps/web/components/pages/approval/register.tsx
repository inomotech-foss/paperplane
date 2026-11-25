/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import useSWR from "swr";
// plane imports
import { Badge } from "@makeplane/propel/components/badge";
import { renderFormattedDate } from "@plane/utils";
// components
import { DataTable } from "@/components/common/data-table";
import type { DataTableColumn } from "@/components/common/data-table";
// hooks
import { useMember } from "@/hooks/store/use-member";
// services
import { PageApprovalService } from "@/services/page";
import type { TPageApprovalRegisterRow } from "@/services/page";
// store
import { approvalBadge } from "@/store/pages/page-approval";

const service = new PageApprovalService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

const registerColumns = (
  workspaceSlug: string,
  projectId: string,
  nameOf: (userId: string) => string
): DataTableColumn<TPageApprovalRegisterRow>[] => [
  {
    key: "name",
    content: "Page",
    tdRender: (row) => (
      <Link className="hover:underline" href={`/${workspaceSlug}/projects/${projectId}/pages/${row.page}`}>
        {row.name || "Untitled"}
      </Link>
    ),
  },
  {
    key: "status",
    content: "Status",
    tdRender: (row) => {
      const badge = approvalBadge(row);
      return <Badge variant={badge.variant} size="sm" label={badge.label} />;
    },
  },
  {
    key: "revision",
    content: "Rev",
    tdRender: (row) => (row.revision ? String(row.revision) : "–"),
  },
  {
    key: "approved",
    content: "Approved",
    tdRender: (row) =>
      row.approved_at
        ? `${renderFormattedDate(row.approved_at)}${row.approved_by ? ` by ${nameOf(row.approved_by)}` : ""}`
        : "–",
  },
  {
    key: "changes",
    content: "Unapproved changes",
    tdRender: (row) => (row.approved_version ? (row.has_unapproved_changes ? "Yes" : "No") : "–"),
  },
  {
    key: "review",
    content: "Next review",
    tdRender: (row) =>
      row.next_review_date ? (
        <span className={row.is_review_overdue ? "font-medium text-danger-primary" : undefined}>
          {renderFormattedDate(row.next_review_date)}
          {row.is_review_overdue ? " (overdue)" : ""}
        </span>
      ) : (
        "–"
      ),
  },
];

/** The document register: every live page of the project with its approval state. */
export const PageApprovalRegister = observer(function PageApprovalRegister(props: Props) {
  const { workspaceSlug, projectId } = props;
  const { getUserDetails } = useMember();
  const { data, isLoading, error } = useSWR<TPageApprovalRegisterRow[], unknown>(
    `PAGE_APPROVAL_REGISTER_${projectId}`,
    () => service.register(workspaceSlug, projectId)
  );
  const columns = registerColumns(
    workspaceSlug,
    projectId,
    (userId) => getUserDetails(userId)?.display_name ?? "unknown"
  );

  return (
    <div className="size-full overflow-auto p-5">
      {error ? (
        <p className="text-13 text-secondary">The document register could not be loaded.</p>
      ) : (
        <DataTable columns={columns} data={data ?? []} keyExtractor={(row) => row.page} isLoading={isLoading} />
      )}
    </div>
  );
});
