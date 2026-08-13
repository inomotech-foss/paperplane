/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IOAuthApplication } from "@plane/types";
import { AlertModalCore, Loader } from "@plane/ui";
// components
import { PageWrapper } from "@/components/common/page-wrapper";
// hooks
import { useOAuthApplication } from "@/hooks/store";
// types
import type { Route } from "./+types/page";
// local
import { OAuthApplicationCredentials } from "./credentials";
import { OAuthApplicationForm } from "./form";
import { OAuthApplicationListItem } from "./list-item";

const OAuthApplicationsPage = observer(function OAuthApplicationsPage(_props: Route.ComponentProps) {
  // store
  const { applicationIds, loader, fetchApplications, deleteApplication } = useOAuthApplication();
  // states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<IOAuthApplication | undefined>(undefined);
  const [created, setCreated] = useState<IOAuthApplication | undefined>(undefined);
  const [revoking, setRevoking] = useState<IOAuthApplication | undefined>(undefined);
  const [isRevoking, setIsRevoking] = useState(false);

  useSWR("INSTANCE_OAUTH_APPLICATIONS", () => fetchApplications());

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(undefined);
  };

  const handleRevoke = async () => {
    if (!revoking) return;
    setIsRevoking(true);
    try {
      await deleteApplication(revoking.id);
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Revoked",
        message: `${revoking.name} can no longer sign anyone in.`,
      });
      setRevoking(undefined);
    } catch (error) {
      const message = (error as { error?: string })?.error ?? "The application was not revoked.";
      setToast({ type: TOAST_TYPE.ERROR, title: "That did not work", message });
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <PageWrapper
      header={{
        title: "OAuth applications",
        description:
          "Clients that can ask your users for access, such as the MCP server. Each user picks which workspaces the client may act in when they sign in.",
      }}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-16 font-medium">
            Registered applications <span className="text-tertiary">&bull; {applicationIds.length}</span>
          </div>
          <Button
            variant="primary"
            size="base"
            onClick={() => {
              setEditing(undefined);
              setIsFormOpen(true);
            }}
          >
            Register application
          </Button>
        </div>

        {loader === "init-loader" ? (
          <Loader className="space-y-4">
            <Loader.Item height="96px" width="100%" />
            <Loader.Item height="96px" width="100%" />
          </Loader>
        ) : applicationIds.length === 0 ? (
          <p className="rounded-lg border border-subtle bg-layer-1 p-6 text-13 text-tertiary">
            No applications yet. Register one to get a client ID and secret for the MCP server.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {applicationIds.map((applicationId) => (
              <OAuthApplicationListItem
                key={applicationId}
                applicationId={applicationId}
                onEdit={(application) => {
                  setEditing(application);
                  setIsFormOpen(true);
                }}
                onRevoke={setRevoking}
              />
            ))}
          </div>
        )}
      </div>

      <OAuthApplicationForm
        isOpen={isFormOpen}
        handleClose={closeForm}
        application={editing}
        onCreated={(application) => {
          closeForm();
          setCreated(application);
        }}
      />

      {created && <OAuthApplicationCredentials application={created} handleClose={() => setCreated(undefined)} />}

      <AlertModalCore
        isOpen={Boolean(revoking)}
        handleClose={() => setRevoking(undefined)}
        handleSubmit={handleRevoke}
        isSubmitting={isRevoking}
        primaryButtonText={{ default: "Revoke", loading: "Revoking" }}
        title={`Revoke ${revoking?.name}?`}
        content={
          <>
            The client ID and secret stop working immediately.
            {revoking?.installations
              ? ` This also revokes ${revoking.installations} ${revoking.installations === 1 ? "grant" : "grants"}, and those users would have to sign in again.`
              : ""}
          </>
        }
      />
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: "OAuth Applications - God Mode" }];

export default OAuthApplicationsPage;
