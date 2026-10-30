/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import useSWR, { mutate } from "swr";
import { setToast } from "@plane/blocks/toast";
import type { IWorkspaceIntegration } from "@plane/types";
// assets
import GithubLogo from "@/app/assets/logos/github-square.png?url";
import SlackLogo from "@/app/assets/services/slack.png?url";
// components
import { SelectChannel } from "@/components/integration/slack/select-channel";
import { SelectRepository } from "@/components/integration/github/select-repository";
// constants
import { PROJECT_GITHUB_REPOSITORY } from "@plane/constants";
// services
import { ProjectService } from "@/services/project";
import { getStringField, isRecord } from "@/helpers/narrow.helper";

type Props = {
  integration: IWorkspaceIntegration;
};

const integrationDetails: Record<string, { logo: string; description: string }> = {
  github: {
    logo: GithubLogo,
    description: "Select GitHub repository to enable sync.",
  },
  slack: {
    logo: SlackLogo,
    description: "Get regular updates and control which notification you want to receive.",
  },
};

// services
const projectService = new ProjectService();

const getRepositorySyncData = (repo: unknown) => {
  if (!isRecord(repo) || !isRecord(repo.owner)) return null;
  const { html_url, id, name } = repo;
  const { login } = repo.owner;
  if (typeof html_url !== "string" || typeof name !== "string" || typeof login !== "string") return null;
  if (typeof id !== "string" && typeof id !== "number") return null;
  return { name, owner: login, repository_id: String(id), url: html_url };
};

const getSyncedRepositoryName = (synced: unknown) => {
  if (!Array.isArray(synced)) return null;
  const first: unknown = synced[0];
  if (!isRecord(first) || !isRecord(first.repo_detail)) return null;
  const owner = getStringField(first.repo_detail, "owner");
  const name = getStringField(first.repo_detail, "name");
  return owner !== undefined && name !== undefined ? `${owner}/${name}` : null;
};

export function IntegrationCard({ integration }: Props) {
  const { workspaceSlug, projectId } = useParams();

  const { data: syncedGithubRepository } = useSWR(
    projectId ? PROJECT_GITHUB_REPOSITORY(projectId) : null,
    (): Promise<unknown> | null =>
      workspaceSlug && projectId && integration
        ? projectService.getProjectGithubRepository(workspaceSlug, projectId, integration.id)
        : null
  );
  const syncedRepositoryName = getSyncedRepositoryName(syncedGithubRepository);

  const handleChange = (repo: unknown) => {
    if (!workspaceSlug || !projectId || !integration) return;

    const syncData = getRepositorySyncData(repo);
    if (!syncData) return;
    const { owner: login, name } = syncData;

    projectService
      .syncGithubRepository(workspaceSlug, projectId, integration.id, syncData)
      .then(() => {
        mutate(PROJECT_GITHUB_REPOSITORY(projectId));

        setToast({
          type: "success",
          title: "Success!",
          message: `${login}/${name} repository synced with the project successfully.`,
        });
      })
      .catch((err: unknown) => {
        console.error(err);
        setToast({
          type: "error",
          title: "Error!",
          message: "Repository could not be synced with the project. Please try again.",
        });
      });
  };

  return (
    <>
      {integration && (
        <div className="flex items-center justify-between gap-2 border-b border-subtle bg-surface-1 px-4 py-6">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 flex-shrink-0">
              <img
                src={integrationDetails[integration.integration_detail.provider].logo}
                className="h-full w-full object-cover"
                alt={`${integration.integration_detail.title} Logo`}
              />
            </div>
            <div>
              <h3 className="flex items-center gap-4 text-13 font-medium">{integration.integration_detail.title}</h3>
              <p className="text-13 tracking-tight text-secondary">
                {integrationDetails[integration.integration_detail.provider].description}
              </p>
            </div>
          </div>
          {integration.integration_detail.provider === "github" && (
            <SelectRepository
              integration={integration}
              value={syncedRepositoryName}
              label={syncedRepositoryName ?? "Select Repository"}
              onChange={handleChange}
            />
          )}
          {integration.integration_detail.provider === "slack" && <SelectChannel integration={integration} />}
        </div>
      )}
    </>
  );
}
