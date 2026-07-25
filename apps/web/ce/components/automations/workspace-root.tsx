/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Plus } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Loader } from "@plane/ui";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";
import { useUserPermissions } from "@/hooks/store/user";
// local imports
import { AutomationCreateModal } from "./create-modal";
import { useAutomationMetadata } from "./helpers/metadata";
import { AutomationsTable } from "./list/table";

type Props = {
  workspaceSlug: string;
};

/**
 * Workspace-level automations: rules that run across every project, or across a
 * chosen subset. Same designer as the project-scoped list, minus the properties
 * whose values only exist inside a single project.
 */
export const WorkspaceAutomationsRoot = observer(function WorkspaceAutomationsRoot(props: Props) {
  const { workspaceSlug } = props;
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const { fetchAutomations, getWorkspaceAutomations } = useAutomation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // The list needs the catalog too, for trigger labels.
  useAutomationMetadata(workspaceSlug);

  const { isLoading } = useSWR(
    workspaceSlug ? `WORKSPACE_AUTOMATIONS_${workspaceSlug}` : null,
    workspaceSlug ? () => fetchAutomations(workspaceSlug) : null
  );

  const automations = getWorkspaceAutomations();
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE, workspaceSlug);

  return (
    <div className="w-full">
      <AutomationCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        workspaceSlug={workspaceSlug}
      />

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-body-md-semibold">{t("automations.global_automations.settings.title")}</h3>
          <p className="mt-0.5 text-13 text-tertiary">{t("automations.global_automations.settings.description")}</p>
        </div>
        <Button
          variant="primary"
          size="lg"
          prependIcon={<Plus />}
          onClick={() => setIsCreateOpen(true)}
          disabled={!isAdmin}
        >
          {t("automations.settings.create_automation")}
        </Button>
      </header>

      {isLoading && !automations ? (
        <Loader className="flex flex-col gap-2">
          <Loader.Item height="44px" />
          <Loader.Item height="44px" />
          <Loader.Item height="44px" />
        </Loader>
      ) : !automations || automations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-subtle bg-surface-2 px-6 py-10 text-center">
          <h4 className="text-body-sm-semibold">{t("automations.empty_state.no_automations.title")}</h4>
          <p className="mx-auto mt-1 max-w-lg text-13 text-tertiary">
            {t("automations.empty_state.no_automations.description")}
          </p>
        </div>
      ) : (
        <AutomationsTable workspaceSlug={workspaceSlug} automations={automations} disabled={!isAdmin} />
      )}
    </div>
  );
});
