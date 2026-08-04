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

export type TCustomAutomationsRootProps = {
  projectId: string;
  workspaceSlug: string;
};

/**
 * Custom automations section of the project settings page: the rule list plus
 * the entry point into the designer.
 */
export const CustomAutomationsRoot = observer(function CustomAutomationsRoot(props: TCustomAutomationsRootProps) {
  const { projectId, workspaceSlug } = props;
  const { t } = useTranslation();
  const { allowPermissions } = useUserPermissions();
  const { fetchAutomations, getProjectAutomations } = useAutomation();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // The list needs the catalog too, for trigger labels.
  useAutomationMetadata(workspaceSlug);

  const { isLoading } = useSWR(
    workspaceSlug && projectId ? `PROJECT_AUTOMATIONS_${projectId}` : null,
    workspaceSlug && projectId ? () => fetchAutomations(workspaceSlug, projectId) : null
  );

  const automations = getProjectAutomations(projectId);
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT, workspaceSlug, projectId);

  return (
    <section className="mt-10 border-t border-subtle pt-8">
      <AutomationCreateModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        workspaceSlug={workspaceSlug}
        projectId={projectId}
      />

      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-body-md-semibold">{t("automations.settings.title")}</h3>
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
        <AutomationsTable
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          automations={automations}
          disabled={!isAdmin}
        />
      )}
    </section>
  );
});
