/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { Button } from "@makeplane/propel/components/button";
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
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import { DateSelect } from "@plane/blocks/property-select";
import { setToast } from "@plane/blocks/toast";
import { ApiError } from "@plane/services";
import { getDate, renderFormattedPayloadDate } from "@plane/utils";
// store
import type { PageApprovalStore } from "@/store/pages/page-approval.store";

export type TPageApprovalAction = "submit" | "approve" | "reject";

const COPY: Record<TPageApprovalAction, { title: string; button: string; done: string; placeholder: string }> = {
  submit: {
    title: "Submit for review",
    button: "Submit",
    done: "Submitted for review.",
    placeholder: "What changed, and why (optional)",
  },
  approve: {
    title: "Approve this version",
    button: "Approve",
    done: "Version approved. It is now the version in force.",
    placeholder: "Approval note (optional)",
  },
  reject: {
    title: "Reject this version",
    button: "Reject",
    done: "Version rejected.",
    placeholder: "Why is this version rejected? (required)",
  },
};

type Props = {
  action: TPageApprovalAction | undefined;
  approval: PageApprovalStore;
  onClose: () => void;
};

/** Reads the refusal the API sends back, so the toast says why. */
const errorMessage = (error: unknown) => (error instanceof ApiError && error.error) || "Please try again.";

export const PageApprovalActionModal = observer(function PageApprovalActionModal(props: Props) {
  const { action, approval, onClose } = props;
  // states
  const [comment, setComment] = useState("");
  const [reviewDate, setReviewDate] = useState<Date | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  // derived values
  const copy = action ? COPY[action] : undefined;
  const isCommentMissing = action === "reject" && !comment.trim();

  useEffect(() => {
    if (!action) return;
    setComment("");
    setReviewDate(getDate(approval.status?.next_review_date) ?? null);
  }, [action, approval]);

  const handleSubmit = async () => {
    if (!action || isCommentMissing) return;
    setIsSubmitting(true);
    try {
      if (action === "submit") await approval.submit(comment);
      if (action === "approve")
        await approval.approve(comment, reviewDate ? (renderFormattedPayloadDate(reviewDate) ?? null) : null);
      if (action === "reject") await approval.reject(comment);
      setToast({ type: "success", title: copy?.done ?? "" });
      onClose();
    } catch (error) {
      setToast({ type: "error", title: "Could not update the review.", message: errorMessage(error) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={!!action}
      onOpenChange={(open) => {
        if (!open && !isSubmitting) onClose();
      }}
    >
      <DialogContent size="md">
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
                <DialogTitle>{copy?.title}</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody tabIndex={0}>
              <div className="space-y-3">
                <Field name="comment">
                  <TextAreaGroup resize="none">
                    <TextArea
                      size="md"
                      surface="field"
                      autoResize
                      maxRows={8}
                      name="comment"
                      aria-label="Comment"
                      placeholder={copy?.placeholder}
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                    />
                  </TextAreaGroup>
                </Field>
                {action === "approve" && (
                  <div className="flex items-center justify-between gap-2 text-13 text-secondary">
                    <span>Next review</span>
                    <DateSelect
                      value={reviewDate}
                      onChange={setReviewDate}
                      minDate={new Date()}
                      placeholder="In a year"
                      clearable
                      clearLabel="In a year"
                      variant="pill-md"
                    />
                  </div>
                )}
              </div>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button variant="secondary" size="md" stretch="auto" onClick={onClose} label="Cancel" />
            <Button
              variant={action === "reject" ? "danger" : "primary"}
              size="md"
              stretch="auto"
              type="submit"
              disabled={isCommentMissing}
              loading={isSubmitting}
              label={copy?.button ?? ""}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
});
