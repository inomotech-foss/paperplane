/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EModalPosition, EModalWidth, Input, ModalCore } from "@plane/ui";
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
          type: TOAST_TYPE.SUCCESS,
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
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.LG}>
      <form onSubmit={handleSubmit} className="px-5 py-4">
        <h3 className="text-18 font-medium 2xl:text-20">Change work item numbering</h3>
        <p className="mt-3 text-13 text-secondary">
          The next work item created in this project is currently {identifier}-{sequence.next_sequence}. Enter the
          number the next work item should receive instead. Numbers only count up, and existing work items keep their
          numbers.
        </p>
        <div className="mt-4 flex flex-col gap-1">
          <label htmlFor="issue-sequence-start" className="text-13">
            Next work item number
          </label>
          <div className="flex items-center gap-2">
            <span className="text-13 font-medium text-secondary">{identifier}-</span>
            <Input
              id="issue-sequence-start"
              name="issue-sequence-start"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError(null);
              }}
              hasError={Boolean(error)}
              placeholder={String(sequence.next_sequence)}
              className="w-full font-medium"
            />
          </div>
          {error && <span className="text-11 text-danger-primary">{error}</span>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" size="lg" onClick={handleClose} type="button">
            {t("cancel")}
          </Button>
          <Button variant="primary" size="lg" type="submit" loading={isLoading} disabled={!isValid || isLoading}>
            {isLoading ? t("updating") : t("update")}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
}
