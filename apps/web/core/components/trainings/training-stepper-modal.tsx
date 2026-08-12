/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { EModalPosition, EModalWidth, ModalCore } from "@plane/ui";
// constants
import type { TTrainingModule } from "@/constants/trainings";
// hooks
import { useUserTrainings } from "@/hooks/store/user";

type Props = {
  training: TTrainingModule | undefined;
  isOpen: boolean;
  handleClose: () => void;
};

export const TrainingStepperModal = observer(function TrainingStepperModal(props: Props) {
  const { training, isOpen, handleClose } = props;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { getCompletedSteps, markStepCompleted, markCompleted } = useUserTrainings();
  // states
  const [stepIndex, setStepIndex] = useState(0);

  // resume from the first incomplete step every time a training is opened
  useEffect(() => {
    if (!isOpen || !training) return;
    const completedSteps = new Set(getCompletedSteps(training.key));
    const firstIncomplete = training.steps.findIndex((step) => !completedSteps.has(step.key));
    setStepIndex(firstIncomplete === -1 ? 0 : firstIncomplete);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, training?.key]);

  if (!training) return null;

  const currentStep = training.steps[stepIndex];
  const isLastStep = stepIndex === training.steps.length - 1;
  const Icon = training.icon;

  const handleNext = () => {
    void markStepCompleted(training.key, currentStep.key);
    if (isLastStep) {
      void markCompleted(training.key);
      handleClose();
    } else {
      setStepIndex(stepIndex + 1);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.CENTER} width={EModalWidth.XXL}>
      <div className="flex flex-col overflow-hidden rounded-lg">
        <div className="grid h-52 place-items-center overflow-hidden bg-accent-primary">
          {currentStep?.image ? (
            <img src={currentStep.image} className="h-full w-full object-cover" alt={t(currentStep.i18n_title)} />
          ) : (
            <Icon className="size-14 text-on-color" />
          )}
        </div>
        <div className="flex flex-col gap-3 p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-11 font-medium text-secondary">{t(training.i18n_title)}</span>
            <span className="text-11 text-secondary">
              {t("trainings.step_of", { current: stepIndex + 1, total: training.steps.length })}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <h3 className="text-16 font-semibold text-primary">{t(currentStep.i18n_title)}</h3>
            <p className="text-13 text-secondary">{t(currentStep.i18n_description)}</p>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {training.steps.map((step, index) => (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`size-1.5 rounded-full transition-colors ${
                    index === stepIndex ? "bg-accent-primary" : "bg-layer-2 hover:bg-layer-1"
                  }`}
                  aria-label={t(step.i18n_title)}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {stepIndex > 0 && (
                <Button variant="secondary" onClick={() => setStepIndex(stepIndex - 1)}>
                  {t("product_tour.actions.back")}
                </Button>
              )}
              <Button variant="primary" onClick={handleNext}>
                {isLastStep ? t("product_tour.actions.done") : t("product_tour.actions.next")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ModalCore>
  );
});
