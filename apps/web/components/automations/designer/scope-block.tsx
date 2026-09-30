/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Globe } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TAutomation } from "@plane/types";
// local imports
import { AutomationValueInput } from "./value-input";

type Props = {
  automation: TAutomation;
  onChange: (payload: { applies_to_all_projects?: boolean; project_ids?: string[] }) => void;
  disabled?: boolean;
};

/**
 * Which projects a workspace-scoped automation runs on: every project in the
 * workspace, or an explicit list. Project-scoped automations don't render this —
 * they're pinned to the project whose settings they live under.
 */
export const AutomationScopeBlock = observer(function AutomationScopeBlock(props: Props) {
  const { automation, onChange, disabled } = props;
  const { t } = useTranslation();

  const appliesToAll = automation.applies_to_all_projects;

  return (
    <section className="rounded-lg border border-subtle bg-layer-2 p-4">
      <header className="mb-3 flex items-center gap-2">
        <div className="grid size-7 shrink-0 place-items-center rounded-sm bg-layer-3">
          <Globe className="size-4 text-accent-primary" />
        </div>
        <h3 className="text-body-sm-semibold">{t("automations.scope.run_on")}</h3>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2">
          {(
            [
              { value: true, label: "all_projects" },
              { value: false, label: "select_projects" },
            ] as const
          ).map((option) => (
            <label
              key={option.label}
              className="flex cursor-pointer items-start gap-2.5 rounded-md border border-subtle bg-surface-2 px-3 py-2.5 hover:bg-layer-1"
            >
              <input
                type="radio"
                name="automation-project-scope"
                checked={appliesToAll === option.value}
                disabled={disabled}
                onChange={() => onChange({ applies_to_all_projects: option.value })}
                className="accent-accent-primary mt-0.5"
              />
              <span className="min-w-0">
                <span className="block text-13 font-medium text-primary">
                  {t(`automations.global_automations.project_select.${option.label}.label`)}
                </span>
                <span className="block text-11 text-tertiary">
                  {t(`automations.global_automations.project_select.${option.label}.description`)}
                </span>
              </span>
            </label>
          ))}
        </div>

        {!appliesToAll && (
          <div className="max-w-md">
            <span className="mb-1.5 block text-13 font-medium text-secondary">
              {t("automations.global_automations.project_select.label")}
            </span>
            <AutomationValueInput
              kind="multi_option"
              source="projects"
              multiple
              value={automation.projects}
              onChange={(value) => onChange({ project_ids: value as string[] })}
              disabled={disabled}
            />
          </div>
        )}
      </div>
    </section>
  );
});
