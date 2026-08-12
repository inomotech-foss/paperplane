/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { CheckCircle2 } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
// constants
import type { TTrainingModule } from "@/constants/trainings";
// hooks
import { useUserTrainings } from "@/hooks/store/user";

type Props = {
  training: TTrainingModule;
  // whether the training was unseen when the page was opened, so the chip
  // stays visible even after the visit marks everything as seen
  isNew: boolean;
  onOpen: (trainingKey: string) => void;
};

export const TrainingCard = observer(function TrainingCard(props: Props) {
  const { training, isNew, onOpen } = props;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { isCompleted, getCompletedSteps } = useUserTrainings();
  // derived values
  const completed = isCompleted(training.key);
  const completedStepsCount = getCompletedSteps(training.key).filter((stepKey) =>
    training.steps.some((step) => step.key === stepKey)
  ).length;
  const totalSteps = training.steps.length;
  const started = completedStepsCount > 0;
  const actionLabel = completed ? t("trainings.review") : started ? t("trainings.resume") : t("trainings.start");
  const Icon = training.icon;

  return (
    <button
      type="button"
      onClick={() => onOpen(training.key)}
      className="group flex flex-col gap-3 rounded-lg border border-subtle bg-surface-1 p-4 text-left transition-colors hover:border-strong hover:bg-layer-1"
    >
      <div className="flex w-full items-center justify-between gap-2">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-layer-1 text-secondary group-hover:bg-surface-1">
          <Icon className="size-4.5" />
        </span>
        {isNew && !completed && (
          <span className="rounded-full bg-accent-primary/15 px-2 py-0.5 text-11 font-medium text-accent-primary">
            {t("trainings.new")}
          </span>
        )}
        {completed && (
          <span className="flex items-center gap-1 text-11 font-medium text-success-primary">
            <CheckCircle2 className="size-3.5" />
            {t("common.completed")}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="text-14 font-semibold text-primary">{t(training.i18n_title)}</h3>
        <p className="text-12 text-secondary">{t(training.i18n_description)}</p>
      </div>
      <div className="mt-auto flex w-full flex-col gap-2">
        <div className="h-1 w-full overflow-hidden rounded-full bg-layer-1">
          <div
            className="h-full rounded-full bg-accent-primary transition-all"
            style={{ width: `${totalSteps > 0 ? Math.round((completedStepsCount / totalSteps) * 100) : 0}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-11 text-secondary">
          <span>{t("trainings.step_count", { count: totalSteps })}</span>
          <span className="font-medium text-accent-primary">{actionLabel}</span>
        </div>
      </div>
    </button>
  );
});
