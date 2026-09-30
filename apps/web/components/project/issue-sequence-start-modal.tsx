/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { useTranslation } from "@plane/i18n";
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
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { setToast } from "@plane/blocks/toast";
// services
import { ProjectService } from "@/services/project";
import type { TProjectIssueSequence } from "@/services/project";

type Props = {
  workspaceSlug: string;
  projectId: string;
  identifier: string;
  sequence: TProjectIssueSequence;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (sequence: TProjectIssueSequence) => void;
};

const projectService = new ProjectService();

export function IssueSequenceStartModal(props: Props) {
  const { workspaceSlug, projectId, identifier, sequence, isOpen, onClose, onUpdated } = props;
  // states
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  // translation
  const { t } = useTranslation();
  // derived values
  const start = /^\d+$/.test(value.trim()) ? Number(value.trim()) : null;
  const isValid = start !== null && start > sequence.last_sequence;

  const handleClose = () => {
    setValue("");
    setError(null);
    setIsLoading(false);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (start === null) {
      setError("Enter a whole number.");
      return;
    }
    if (start <= sequence.last_sequence) {
      setError(`The number must be greater than ${sequence.last_sequence}.`);
      return;
    }

    setIsLoading(true);
    setError(null);
    await projectService
      .setIssueSequenceStart(workspaceSlug, projectId, start)
      .then((updated) => {
        setToast({
          type: "success",
          title: "Numbering updated",
          message: `The next work item will be ${identifier}-${updated.next_sequence}.`,
        });
        onUpdated(updated);
        handleClose();
        return;
      })
      .catch((response: { error?: string } | undefined) => {
        setError(response?.error ?? "The numbering could not be changed. Please try again.");
      })
      .finally(() => setIsLoading(false));
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>Change work item numbering</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>
              <p className="text-13 text-secondary">
                The next work item created in this project is currently {identifier}-{sequence.next_sequence}. Enter the
                number the next work item should receive instead. Numbers only count up, and existing work items keep
                their numbers.
              </p>
              <div className="mt-4 flex flex-col gap-1">
                <label htmlFor="issue-sequence-start" className="text-13">
                  Next work item number
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-13 font-medium text-secondary">{identifier}-</span>
                  <Field invalid={Boolean(error)}>
                    <InputGroup size="md">
                      <Input
                        id="issue-sequence-start"
                        name="issue-sequence-start"
                        type="text"
                        size="md"
                        inputMode="numeric"
                        autoComplete="off"
                        value={value}
                        onChange={(e) => {
                          setValue(e.target.value);
                          setError(null);
                        }}
                        placeholder={String(sequence.next_sequence)}
                      />
                    </InputGroup>
                  </Field>
                </div>
                {error && <span className="text-11 text-danger-primary">{error}</span>}
              </div>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button
              variant="secondary"
              size="md"
              stretch="auto"
              type="button"
              label={t("cancel")}
              onClick={handleClose}
            />
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              type="submit"
              loading={isLoading}
              disabled={!isValid || isLoading}
              label={isLoading ? t("updating") : t("update")}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
