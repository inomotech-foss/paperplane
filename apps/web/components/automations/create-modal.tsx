/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useNavigate } from "react-router";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@makeplane/propel/components/button";
import { Dialog, DialogBody, DialogContent } from "@makeplane/propel/components/dialog";
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { setToast } from "@plane/blocks/toast";
import type { TAutomation } from "@plane/types";
// hooks
import { useAutomation } from "@/hooks/store/use-automation";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  /** Omitted for workspace-scoped rules. */
  projectId?: string;
  /** When set the modal renames an existing automation instead of creating one. */
  automation?: TAutomation;
};

/**
 * The form body. State is seeded from props on mount only — the wrapper remounts
 * it via `key` whenever the modal opens or switches automation, which is why
 * there's no effect syncing state back to props.
 */
const AutomationForm = observer(function AutomationForm(props: Omit<Props, "isOpen">) {
  const { onClose, workspaceSlug, projectId, automation } = props;
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { createAutomation, updateAutomation } = useAutomation();

  const [name, setName] = useState(automation?.name ?? "");
  const [description, setDescription] = useState(automation?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("automations.create_modal.title.required_error"));
      return;
    }

    setIsSubmitting(true);
    try {
      if (automation) {
        await updateAutomation(workspaceSlug, automation.id, { name: trimmed, description }, projectId);
        setToast({
          type: "success",
          title: t("automations.toasts.update.success.title"),
          message: t("automations.toasts.update.success.message"),
        });
      } else {
        const created = await createAutomation(
          workspaceSlug,
          {
            name: trimmed,
            description,
            // A workspace rule has to target something on create; start it at
            // every project and let the designer's scope block narrow it down.
            ...(projectId ? {} : { applies_to_all_projects: true }),
          },
          projectId
        );
        setToast({
          type: "success",
          title: t("automations.toasts.create.success.title"),
          message: t("automations.toasts.create.success.message"),
        });
        // Go straight to the designer; a name on its own does nothing yet.
        navigate(
          projectId
            ? `/${workspaceSlug}/settings/projects/${projectId}/automations/${created.id}/`
            : `/${workspaceSlug}/settings/automations/${created.id}/`
        );
      }
      onClose();
    } catch (submitError) {
      const payload = submitError as { name?: string[] | string; error?: string };
      const message =
        (Array.isArray(payload?.name) ? payload.name[0] : payload?.name) ??
        payload?.error ??
        t(automation ? "automations.toasts.update.error.message" : "automations.toasts.create.error.message");
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-5">
      <h3 className="text-body-md-semibold">
        {t(automation ? "automations.create_modal.heading.update" : "automations.create_modal.heading.create")}
      </h3>

      <div>
        <label htmlFor="automation-name" className="sr-only">
          {t("automations.create_modal.title.placeholder")}
        </label>
        <Field invalid={!!error}>
          <InputGroup size="lg">
            <Input
              id="automation-name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              placeholder={t("automations.create_modal.title.placeholder")}
              size="lg"
            />
          </InputGroup>
        </Field>
        {error && <p className="mt-1 text-11 text-danger-primary">{error}</p>}
      </div>

      <div>
        <label htmlFor="automation-description" className="sr-only">
          {t("automations.create_modal.description.placeholder")}
        </label>
        <textarea
          id="automation-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={t("automations.create_modal.description.placeholder")}
          rows={3}
          className="placeholder-tertiary w-full rounded-md border-[0.5px] border-subtle-1 bg-layer-2 px-3 py-2 text-13 focus:outline-none"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="md" stretch="auto" label={t("common.cancel")} onClick={onClose} />
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          label={t(
            automation
              ? "automations.create_modal.submit_button.update"
              : "automations.create_modal.submit_button.create"
          )}
          onClick={() => void handleSubmit()}
          loading={isSubmitting}
        />
      </div>
    </div>
  );
});

/**
 * Names an automation. The trigger, conditions and actions are configured in the
 * designer, which this modal opens on create.
 */
export const AutomationCreateModal = observer(function AutomationCreateModal(props: Props) {
  const { isOpen, onClose, ...rest } = props;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        <DialogBody tabIndex={0}>
          {/* Remount to reset the fields, rather than syncing state from props in an
            effect — that briefly showed the previous automation's name. */}
          <AutomationForm key={`${rest.automation?.id ?? "new"}:${isOpen}`} onClose={onClose} {...rest} />
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
});
