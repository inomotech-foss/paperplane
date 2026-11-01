/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Filter } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import type { TAutomation, TAutomationConditionNode, TAutomationMetadata } from "@plane/types";
import { AutomationConditionBuilder } from "./condition-builder";
import { RawAutomationValue } from "./raw-value";

type Props = {
  projectId: string | undefined;
  automation: TAutomation;
  metadata: TAutomationMetadata | undefined;
  condition: TAutomationConditionNode | null;
  onChange: (condition: TAutomationConditionNode | null) => void;
  disabled?: boolean;
};

/** The condition of an automation. A stored condition the client cannot read is shown as it is. */
export const AutomationConditionSection = observer(function AutomationConditionSection(props: Props) {
  const { projectId, automation, metadata, condition, onChange, disabled } = props;
  const { t } = useTranslation();
  const isReadable = automation.raw_condition === undefined;

  return (
    <section className="rounded-lg border border-subtle bg-layer-2 p-4">
      <header className="mb-3 flex items-center gap-2">
        <div className="grid size-7 shrink-0 place-items-center rounded-sm bg-layer-3">
          <Filter className="size-4 text-accent-primary" />
        </div>
        <h3 className="text-body-sm-semibold">{t("automations.condition.label")}</h3>
      </header>
      {isReadable && !condition && (
        <p className="mb-2 text-13 text-tertiary">{t("automations.designer.no_conditions")}</p>
      )}
      {automation.scope === "workspace" && (
        <p className="mb-2 text-11 text-tertiary">{t("automations.designer.workspace_scope_note")}</p>
      )}
      {isReadable ? (
        <AutomationConditionBuilder
          projectId={projectId}
          scope={automation.scope}
          metadata={metadata}
          condition={condition}
          onChange={onChange}
          disabled={disabled}
        />
      ) : (
        <RawAutomationValue value={automation.raw_condition} />
      )}
    </section>
  );
});
