/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useMemo, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { useTranslation } from "@plane/i18n";
// compat
import { useRouter, useSearchParams } from "next/navigation";
// constants
import { TRAININGS_REGISTRY } from "@/constants/trainings";
// hooks
import { useUserTrainings } from "@/hooks/store/user";
// local imports
import { TrainingCard } from "./training-card";
import { TrainingStepperModal } from "./training-stepper-modal";

export const TrainingsRoot = observer(function TrainingsRoot() {
  // plane hooks
  const { t } = useTranslation();
  // router
  const router = useRouter();
  const searchParams = useSearchParams();
  // store hooks
  const trainingsStore = useUserTrainings();
  // snapshot of which trainings were unseen when the page opened, so "New"
  // chips survive the bulk mark-seen below
  const [newKeysSnapshot] = useState<Set<string>>(() => new Set(trainingsStore.unseenKeys));

  // visiting the page acknowledges every new training (clears the help badge)
  useEffect(() => {
    void trainingsStore.markSeen(trainingsStore.unseenKeys);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // deep link: ?training=<key>
  const openTrainingKey = searchParams.get("training");
  const openTraining = useMemo(
    () => TRAININGS_REGISTRY.find((training) => training.key === openTrainingKey),
    [openTrainingKey]
  );

  const handleOpen = (trainingKey: string) => {
    router.push(`?training=${trainingKey}`);
  };

  const handleClose = () => {
    router.push("?");
  };

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto px-8 py-6 md:px-14">
      <TrainingStepperModal training={openTraining} isOpen={!!openTraining} handleClose={handleClose} />
      <div className="flex flex-col gap-1">
        <h1 className="text-20 font-semibold text-primary">{t("trainings.title")}</h1>
        <p className="text-13 text-secondary">{t("trainings.description")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {TRAININGS_REGISTRY.map((training) => (
          <TrainingCard
            key={training.key}
            training={training}
            isNew={newKeysSnapshot.has(training.key)}
            onOpen={handleOpen}
          />
        ))}
      </div>
    </div>
  );
});
