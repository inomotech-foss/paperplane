// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useState } from "react";
import { observer } from "mobx-react";
import {
  AddOutline,
  ChevronDownOutline,
  ChevronUpOutline,
  DeleteOutline,
  EditOutline,
  LinkOutline,
} from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { Icon } from "@makeplane/propel/components/icon";
import { IconButton } from "@makeplane/propel/components/icon-button";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
import type { TProjectSidebarLink, TProjectSidebarLinkPayload } from "@plane/types";
import { useProjectLink } from "@/hooks/store/use-project-link";
import { getProjectLinkErrorMessage, isValidProjectLinkUrl } from "@/store/project/project-link-url";

type TLinkFormProps = {
  initial?: TProjectSidebarLinkPayload;
  onSubmit: (data: TProjectSidebarLinkPayload) => Promise<void>;
  onCancel: () => void;
};

function ProjectLinkForm(props: TLinkFormProps) {
  const { initial, onSubmit, onCancel } = props;
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [url, setUrl] = useState(initial?.url ?? "");
  const [showUrlError, setShowUrlError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isUrlValid = isValidProjectLinkUrl(url);
  const canSubmit = title.trim() !== "" && isUrlValid && !isSubmitting;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isUrlValid) {
      setShowUrlError(true);
      return;
    }
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit({ title: title.trim(), url: url.trim() });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex flex-col gap-3 rounded-md border border-subtle p-3"
    >
      <InputGroup size="md">
        <Input
          size="md"
          aria-label={t("link.modal.title.text")}
          placeholder={t("link.modal.title.text")}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={255}
          autoComplete="off"
        />
      </InputGroup>
      <div className="flex flex-col gap-1">
        <InputGroup size="md">
          <Input
            size="md"
            aria-label={t("link.modal.url.text")}
            placeholder={t("link.modal.url.placeholder")}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            onBlur={() => setShowUrlError(url.trim() !== "" && !isUrlValid)}
            aria-invalid={showUrlError}
            autoComplete="off"
          />
        </InputGroup>
        {showUrlError && (
          <p className="text-body-xs-regular text-danger-primary">{t("project_settings.links.url_invalid")}</p>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" size="md" stretch="auto" onClick={onCancel} label={t("common.cancel")} />
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          type="submit"
          loading={isSubmitting}
          disabled={!canSubmit}
          label={t("save")}
        />
      </div>
    </form>
  );
}

type TLinkRowProps = {
  link: TProjectSidebarLink;
  isFirst: boolean;
  isLast: boolean;
  isMoving: boolean;
  onMove: (direction: -1 | 1) => void;
  onEdit: () => void;
  onDelete: () => void;
};

function ProjectLinkRow(props: TLinkRowProps) {
  const { link, isFirst, isLast, isMoving, onMove, onEdit, onDelete } = props;
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 rounded-md border border-subtle px-3 py-2">
      <LinkOutline className="size-4 flex-shrink-0 text-tertiary" />
      <div className="flex min-w-0 grow flex-col">
        <span className="truncate text-13 font-medium text-primary">{link.title}</span>
        <span className="truncate text-11 text-tertiary">{link.url}</span>
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        <IconButton
          variant="ghost"
          size="sm"
          disabled={isFirst || isMoving}
          onClick={() => onMove(-1)}
          icon={<Icon icon={ChevronUpOutline} />}
          aria-label={t("project_settings.links.move_up")}
        />
        <IconButton
          variant="ghost"
          size="sm"
          disabled={isLast || isMoving}
          onClick={() => onMove(1)}
          icon={<Icon icon={ChevronDownOutline} />}
          aria-label={t("project_settings.links.move_down")}
        />
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onEdit}
          icon={<Icon icon={EditOutline} />}
          aria-label={t("common.edit")}
        />
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onDelete}
          icon={<Icon icon={DeleteOutline} />}
          aria-label={t("common.delete")}
        />
      </div>
    </div>
  );
}

type TProjectLinksSettingsProps = {
  workspaceSlug: string;
  projectId: string;
};

export const ProjectLinksSettings = observer(function ProjectLinksSettings(props: TProjectLinksSettingsProps) {
  const { workspaceSlug, projectId } = props;
  const { t } = useTranslation();
  const { getLinksByProjectId, createLink, updateLink, deleteLink, reorderLinks } = useProjectLink();
  // "new" or the id of the link being edited
  const [editing, setEditing] = useState<string | null>(null);
  const [isMoving, setIsMoving] = useState(false);

  const links = getLinksByProjectId(workspaceSlug, projectId);

  const showError = (key: "not_created" | "not_updated" | "not_removed", error?: unknown) =>
    setToast({
      type: "error",
      title: t(`links.toasts.${key}.title`),
      message: getProjectLinkErrorMessage(error) ?? t(`links.toasts.${key}.message`),
    });

  const handleCreate = async (data: TProjectSidebarLinkPayload) => {
    try {
      await createLink(workspaceSlug, projectId, data);
      setEditing(null);
    } catch (error) {
      showError("not_created", error);
    }
  };

  const handleUpdate = async (linkId: string, data: TProjectSidebarLinkPayload) => {
    try {
      await updateLink(workspaceSlug, projectId, linkId, data);
      setEditing(null);
    } catch (error) {
      showError("not_updated", error);
    }
  };

  const handleDelete = async (linkId: string) => {
    try {
      await deleteLink(workspaceSlug, projectId, linkId);
    } catch (error) {
      showError("not_removed", error);
    }
  };

  const handleMove = async (index: number, direction: -1 | 1) => {
    if (isMoving) return;
    const ids = links.map((link) => link.id);
    const target = index + direction;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setIsMoving(true);
    try {
      await reorderLinks(workspaceSlug, projectId, ids);
    } catch (error) {
      showError("not_updated", error);
    } finally {
      setIsMoving(false);
    }
  };

  return (
    <div className="mt-6 flex w-full flex-col gap-2">
      {links.length === 0 && editing !== "new" && (
        <p className="text-body-xs-regular text-tertiary">{t("common.no_links_added_yet")}</p>
      )}
      {links.map((link, index) =>
        editing === link.id ? (
          <ProjectLinkForm
            key={link.id}
            initial={{ title: link.title, url: link.url }}
            onSubmit={(data) => handleUpdate(link.id, data)}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <ProjectLinkRow
            key={link.id}
            link={link}
            isFirst={index === 0}
            isLast={index === links.length - 1}
            isMoving={isMoving}
            onMove={(direction) => void handleMove(index, direction)}
            onEdit={() => setEditing(link.id)}
            onDelete={() => void handleDelete(link.id)}
          />
        )
      )}
      {editing === "new" ? (
        <ProjectLinkForm onSubmit={handleCreate} onCancel={() => setEditing(null)} />
      ) : (
        <div>
          <Button
            variant="secondary"
            size="md"
            stretch="auto"
            icon={<Icon icon={AddOutline} />}
            onClick={() => setEditing("new")}
            label={t("common.add_link")}
          />
        </div>
      )}
    </div>
  );
});
