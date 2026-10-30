/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
// types
import type { IWorkspaceIntegration, ISlackIntegration } from "@plane/types";
// ui
import { Loader } from "@plane/blocks/skeleton";
// fetch-keys
import { SLACK_CHANNEL_INFO } from "@plane/constants";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
import useIntegrationPopup from "@/hooks/use-integration-popup";
// services
import { AppInstallationService } from "@/services/app_installation.service";
import { getField, isRecord } from "@/helpers/guard.helper";

type Props = {
  integration: IWorkspaceIntegration;
};

const appInstallationService = new AppInstallationService();

const isSlackIntegration = (value: unknown): value is ISlackIntegration =>
  isRecord(value) && typeof value.id === "string" && typeof value.project === "string";

export const SelectChannel = observer(function SelectChannel({ integration }: Props) {
  // store hooks
  const { config } = useInstance();
  // states
  const [slackChannelAvailabilityToggle, setSlackChannelAvailabilityToggle] = useState<boolean>(false);
  const [slackChannel, setSlackChannel] = useState<ISlackIntegration | null>(null);

  const { workspaceSlug, projectId } = useParams();

  // FIXME:
  const { startAuth } = useIntegrationPopup({
    provider: "slackChannel",
    stateParams: integration.id,
    // github_app_name: instance?.config?.github_client_id || "",
    slack_client_id: config?.slack_client_id || "",
  });

  const { data: projectIntegration } = useSWR<unknown>(
    workspaceSlug && projectId && integration.id ? SLACK_CHANNEL_INFO(workspaceSlug, projectId) : null,
    () =>
      workspaceSlug && projectId && integration.id
        ? appInstallationService.getSlackChannelDetail(workspaceSlug, projectId, integration.id)
        : null
  );

  useEffect(() => {
    const projectIntegrations: unknown[] = Array.isArray(projectIntegration) ? projectIntegration : [];
    if (projectId && projectIntegrations.length > 0) {
      const projectSlackIntegrationCheck = projectIntegrations.find(
        (item): item is ISlackIntegration => isSlackIntegration(item) && item.project === projectId
      );
      if (projectSlackIntegrationCheck) {
        setSlackChannel(() => projectSlackIntegrationCheck);
        setSlackChannelAvailabilityToggle(true);
      }
    }
  }, [projectIntegration, projectId]);

  const handleDelete = async () => {
    if (!workspaceSlug || !projectId) return;
    if (Array.isArray(projectIntegration) && projectIntegration.length === 0) return;
    mutate(SLACK_CHANNEL_INFO(workspaceSlug?.toString(), projectId?.toString()), (prevData: unknown) => {
      if (!prevData) return;
      return getField(prevData, "id") !== integration.id;
    }).then(() => {
      setSlackChannelAvailabilityToggle(false);
      setSlackChannel(null);
    });
    appInstallationService
      .removeSlackChannel(workspaceSlug, projectId, integration.id, slackChannel?.id)
      .catch((err: unknown) => console.error(err));
  };

  const handleAuth = async () => {
    await startAuth();
  };

  return (
    <>
      {projectIntegration ? (
        <button
          type="button"
          className={`bg-gray-700 relative inline-flex h-4 w-6 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none`}
          role="switch"
          aria-checked
          onClick={() => {
            slackChannelAvailabilityToggle ? handleDelete() : handleAuth();
          }}
        >
          <span
            aria-hidden="true"
            className={`shadow inline-block h-2 w-2 transform self-center rounded-full bg-white ring-0 transition duration-200 ease-in-out ${
              slackChannelAvailabilityToggle ? "translate-x-3" : "translate-x-0"
            }`}
          />
        </button>
      ) : (
        <Loader>
          <Loader.Item height="35px" width="150px" />
        </Loader>
      )}
    </>
  );
});
