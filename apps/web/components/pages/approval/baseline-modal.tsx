/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { mutate } from "swr";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { Checkbox } from "@makeplane/propel/components/checkbox";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Field } from "@makeplane/propel/components/field";
import { Switch } from "@makeplane/propel/components/switch";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import { DateSelect } from "@plane/blocks/property-select";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import { ApiError } from "@plane/services";
import { renderFormattedPayloadDate } from "@plane/utils";
// services
import { PageApprovalService } from "@/services/page";
import type { TPageBaselineCandidate, TPageBaselinePreview } from "@/services/page";
// store
import { BASELINE_SKIP_REASON_KEYS, baselineRequest, canBaseline, selectedPageIds } from "@/store/pages/page-baseline";

const service = new PageApprovalService();

export const baselinePreviewKey = (projectId: string) => `PAGE_BASELINE_PREVIEW_${projectId}`;

type Props = {
  workspaceSlug: string;
  projectId: string;
  preview: TPageBaselinePreview | undefined;
  isOpen: boolean;
  onClose: () => void;
};

type RowProps = {
  row: TPageBaselineCandidate;
  selectable: boolean;
  selected: boolean;
  onToggle: (pageId: string, selected: boolean) => void;
};

const BaselineRow = observer(function BaselineRow(props: RowProps) {
  const { row, selectable, selected, onToggle } = props;
  const { t } = useTranslation();
  const reason = row.skip_reason && !selectable ? t(BASELINE_SKIP_REASON_KEYS[row.skip_reason]) : undefined;

  return (
    <li className="flex items-start gap-2 px-3 py-2">
      <Checkbox
        checked={selectable && selected}
        disabled={!selectable}
        onCheckedChange={(checked) => onToggle(row.page, checked)}
        aria-label={t("page_approval_baseline.select_page", { name: row.name })}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-13 text-primary">{row.name}</span>
        {reason ? (
          <span className="text-12 text-tertiary" title={row.skip_reason_label}>
            {reason}
          </span>
        ) : (
          <span className="text-12 text-secondary">{row.legacy_note}</span>
        )}
      </div>
    </li>
  );
});

/**
 * The form mounts fresh each time the modal opens (keyed by the parent), so its
 * state starts from the props instead of being reset by an effect.
 */
const BaselineForm = observer(function BaselineForm(
  props: Omit<Props, "isOpen" | "preview"> & {
    preview: TPageBaselinePreview;
    onSubmittingChange: (isSubmitting: boolean) => void;
  }
) {
  const { workspaceSlug, projectId, preview, onClose, onSubmittingChange } = props;
  const { t } = useTranslation();
  // states
  const [includeLocked, setIncludeLocked] = useState(false);
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(() => new Set());
  const [reviewDate, setReviewDate] = useState<Date | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [minReviewDate] = useState(() => new Date());
  // derived values
  const pageIds = selectedPageIds(preview.pages, includeLocked, excluded);
  const skippedCount = preview.pages.filter((row) => !canBaseline(row, includeLocked)).length;

  const handleToggle = (pageId: string, selected: boolean) => {
    setExcluded((current) => {
      const next = new Set(current);
      if (selected) next.delete(pageId);
      else next.add(pageId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!pageIds.length) return;
    setIsSubmitting(true);
    onSubmittingChange(true);
    try {
      const nextReviewDate = reviewDate ? (renderFormattedPayloadDate(reviewDate) ?? null) : null;
      const result = await service.baseline(
        workspaceSlug,
        projectId,
        baselineRequest({ pageIds, includeLocked, nextReviewDate, comment })
      );
      setToast({
        type: "success",
        title: t("page_approval_baseline.done", { count: result.queued }),
        message: t("page_approval_baseline.done_message"),
      });
      void mutate(baselinePreviewKey(projectId));
      void mutate(`PAGE_APPROVAL_REGISTER_${projectId}`);
      onClose();
    } catch (error) {
      setToast({
        type: "error",
        title: t("page_approval_baseline.failed"),
        message: error instanceof ApiError ? error.error : undefined,
      });
    } finally {
      setIsSubmitting(false);
      onSubmittingChange(false);
    }
  };

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        void handleSubmit();
      }}
    >
      <DialogMain>
        <DialogHeader>
          <DialogHeading>
            <DialogTitle>{t("page_approval_baseline.title")}</DialogTitle>
          </DialogHeading>
        </DialogHeader>
        <DialogBody tabIndex={0}>
          <div className="space-y-3">
            <p className="text-13 text-secondary">{t("page_approval_baseline.description")}</p>
            <div className="flex items-center justify-between gap-2 text-13 text-secondary">
              <span>{t("page_approval_baseline.next_review")}</span>
              <DateSelect
                value={reviewDate}
                onChange={setReviewDate}
                minDate={minReviewDate}
                placeholder={t("page_approval_baseline.no_review_date")}
                clearable
                clearLabel={t("page_approval_baseline.no_review_date")}
                variant="pill-md"
              />
            </div>
            <label className="flex items-center justify-between gap-2 text-13 text-secondary">
              <span>{t("page_approval_baseline.include_locked")}</span>
              <Switch
                size="sm"
                checked={includeLocked}
                onCheckedChange={setIncludeLocked}
                aria-label={t("page_approval_baseline.include_locked")}
              />
            </label>
            <Field name="comment">
              <TextAreaGroup resize="none">
                <TextArea
                  size="md"
                  surface="field"
                  autoResize
                  maxRows={4}
                  name="comment"
                  aria-label={t("page_approval_baseline.comment_placeholder")}
                  placeholder={t("page_approval_baseline.comment_placeholder")}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                />
              </TextAreaGroup>
            </Field>
            <p className="flex gap-3 text-12 text-tertiary">
              <span>{t("page_approval_baseline.selected", { count: pageIds.length })}</span>
              <span>{t("page_approval_baseline.skipped", { count: skippedCount })}</span>
            </p>
            <ul className="max-h-80 divide-y divide-subtle overflow-y-auto rounded-md border border-subtle">
              {preview.pages.map((row) => (
                <BaselineRow
                  key={row.page}
                  row={row}
                  selectable={canBaseline(row, includeLocked)}
                  selected={!excluded.has(row.page)}
                  onToggle={handleToggle}
                />
              ))}
            </ul>
          </div>
        </DialogBody>
      </DialogMain>
      <DialogActions>
        <Button variant="secondary" size="md" stretch="auto" onClick={onClose} label={t("cancel")} />
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          type="submit"
          disabled={!pageIds.length}
          loading={isSubmitting}
          label={t("page_approval_baseline.confirm", { count: pageIds.length })}
        />
      </DialogActions>
    </form>
  );
});

/** Picks the pages to baseline and the options, then queues them. */
export const PageBaselineModal = observer(function PageBaselineModal(props: Props) {
  const { workspaceSlug, projectId, preview, isOpen, onClose } = props;
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent size="lg">
        {isOpen && preview && (
          <BaselineForm
            workspaceSlug={workspaceSlug}
            projectId={projectId}
            preview={preview}
            onClose={onClose}
            onSubmittingChange={setIsSubmitting}
          />
        )}
      </DialogContent>
    </Dialog>
  );
});
