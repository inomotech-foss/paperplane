/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Switch } from "@makeplane/propel/components/switch";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@makeplane/propel/components/table";
import { setToast } from "@plane/blocks/toast";
import type { IInstanceUser, TInstanceUserError } from "@plane/types";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
import { DeactivateUserDialog } from "@/components/users/deactivate-dialog";
import { DeleteUserDialog } from "@/components/users/delete-dialog";
import { findPossibleDuplicates } from "@/components/users/duplicates";
import { MergeUserDialog } from "@/components/users/merge-dialog";
import { UserRow } from "@/components/users/user-row";
import type { TUserRowAction } from "@/components/users/user-row";
// hooks
import { useInstanceUser } from "@/hooks/store";
// types
import type { Route } from "./+types/page";

type TDialog = { action: Exclude<TUserRowAction, "reactivate">; user: IInstanceUser };

const UsersPage = observer(function UsersPage(_props: Route.ComponentProps) {
  // store
  const { userIds, users, loader, paginationInfo, fetchUsers, fetchNextUsers, reactivateUser } = useInstanceUser();
  // states
  const [search, setSearch] = useState("");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [onlyDuplicates, setOnlyDuplicates] = useState(false);
  const [dialog, setDialog] = useState<TDialog | undefined>(undefined);
  // derived values
  const hasNextPage = paginationInfo?.next_page_results && paginationInfo?.next_cursor !== undefined;
  const duplicates = useMemo(() => findPossibleDuplicates(Object.values(users)), [users]);
  const visibleIds = onlyDuplicates ? userIds.filter((id) => duplicates.has(id)) : userIds;

  // Debounced search, also the initial load.
  useEffect(() => {
    const handle = setTimeout(() => {
      fetchUsers({ search: search.trim() || undefined, include_deleted: includeDeleted || undefined });
    }, 300);
    return () => clearTimeout(handle);
  }, [search, includeDeleted, fetchUsers]);

  const handleAction = async (action: TUserRowAction, user: IInstanceUser) => {
    if (action !== "reactivate") {
      setDialog({ action, user });
      return;
    }
    try {
      await reactivateUser(user.id);
      setToast({
        type: "success",
        title: "Reactivated",
        message: `${user.email} can sign in again. Their memberships stay inactive until they are invited back.`,
      });
    } catch (error) {
      setToast({
        type: "error",
        title: "That did not work",
        message: (error as TInstanceUserError)?.error ?? "The user was not reactivated.",
      });
    }
  };

  const closeDialog = () => setDialog(undefined);

  return (
    <PageWrapper
      header={{
        title: "Users on this instance",
        description: "Deactivate, merge or delete accounts. Everything here applies across all workspaces.",
      }}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="w-full max-w-sm">
            <InputGroup size="md">
              <Input
                size="md"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by email or name"
                aria-label="Search users"
              />
            </InputGroup>
          </div>
          <div className="flex items-center gap-6 text-13">
            <label className="flex items-center gap-2" htmlFor="users-show-deleted">
              <Switch id="users-show-deleted" size="sm" checked={includeDeleted} onCheckedChange={setIncludeDeleted} />
              Show deleted
            </label>
            <label className="flex items-center gap-2" htmlFor="users-only-duplicates">
              <Switch
                id="users-only-duplicates"
                size="sm"
                checked={onlyDuplicates}
                onCheckedChange={setOnlyDuplicates}
              />
              Possible duplicates only
            </label>
          </div>
        </div>

        {loader === "init-loader" ? (
          <Skeleton className="space-y-4">
            <Skeleton.Item height="40px" width="100%" />
            <Skeleton.Item height="40px" width="100%" />
            <Skeleton.Item height="40px" width="100%" />
          </Skeleton>
        ) : (
          <>
            <div className="text-11 text-tertiary">
              {visibleIds.length} of {paginationInfo?.total_results ?? userIds.length} users
              {onlyDuplicates && " sharing an email local part or display name with another loaded user"}
            </div>
            <Table variant="table">
              <TableHeader>
                <TableRow>
                  <TableHead label="Email" />
                  <TableHead label="Name" />
                  <TableHead label="Sign-in" />
                  <TableHead label="Status" />
                  <TableHead label="Workspaces" align="end" />
                  <TableHead label="Last login" />
                  <TableHead label="Actions" visuallyHidden />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleIds.map((userId) => (
                  <UserRow
                    key={userId}
                    userId={userId}
                    isPossibleDuplicate={duplicates.has(userId)}
                    onAction={handleAction}
                  />
                ))}
              </TableBody>
            </Table>
            {visibleIds.length === 0 && (
              <p className="rounded-lg border border-subtle bg-layer-1 p-6 text-13 text-tertiary">
                No users match. Duplicates are only found among the users loaded so far, so load more or search.
              </p>
            )}
            {hasNextPage && (
              <div className="flex justify-center">
                <Button
                  variant="ghost"
                  size="md"
                  stretch="auto"
                  onClick={() => fetchNextUsers()}
                  loading={loader === "pagination"}
                  label="Load more"
                />
              </div>
            )}
          </>
        )}
      </div>

      {dialog?.action === "deactivate" && <DeactivateUserDialog isOpen handleClose={closeDialog} user={dialog.user} />}
      {dialog?.action === "delete" && <DeleteUserDialog isOpen handleClose={closeDialog} user={dialog.user} />}
      {dialog?.action === "merge" && <MergeUserDialog isOpen handleClose={closeDialog} source={dialog.user} />}
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: "User Management - God Mode" }];

export default UsersPage;
