/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Boxes, Compass, FileText, Inbox, Layers, ListFilter, Timer } from "lucide-react";
import type { LucideIcon } from "lucide-react";
// assets
import CyclesTraining from "@/app/assets/onboarding/cycles.webp?url";
import IssuesTraining from "@/app/assets/onboarding/issues.webp?url";
import ModulesTraining from "@/app/assets/onboarding/modules.webp?url";
import PagesTraining from "@/app/assets/onboarding/pages.webp?url";
import ViewsTraining from "@/app/assets/onboarding/views.webp?url";

export type TTrainingStep = {
  key: string;
  i18n_title: string;
  i18n_description: string;
  image?: string;
};

export type TTrainingModule = {
  // stable identifier persisted per user on the backend — never rename an
  // existing key; a materially rewritten training ships under a new key
  key: string;
  i18n_title: string;
  i18n_description: string;
  icon: LucideIcon;
  // release the training shipped in, display-only ("Added in ...")
  introduced_at: string;
  steps: TTrainingStep[];
};

const buildSteps = (namespace: string, stepKeys: string[], images: Record<string, string> = {}): TTrainingStep[] =>
  stepKeys.map((stepKey) => ({
    key: stepKey,
    i18n_title: `${namespace}.${stepKey}.title`,
    i18n_description: `${namespace}.${stepKey}.description`,
    image: images[stepKey],
  }));

/**
 * The in-code training catalog. Shipping a new feature? Add an entry here
 * (plus its i18n strings) and every user automatically sees it flagged as
 * "New" — detection is done by diffing these keys against the per-user
 * progress rows on the backend, so no extra wiring is needed.
 */
export const TRAININGS_REGISTRY: TTrainingModule[] = [
  {
    key: "work_items",
    i18n_title: "trainings.modules.work_items.title",
    i18n_description: "trainings.modules.work_items.description",
    icon: Layers,
    introduced_at: "2026-08",
    steps: buildSteps("product_tour.workitems", ["step_zero", "step_one", "step_two", "step_three", "step_four"], {
      step_zero: IssuesTraining,
    }),
  },
  {
    key: "cycles",
    i18n_title: "trainings.modules.cycles.title",
    i18n_description: "trainings.modules.cycles.description",
    icon: Timer,
    introduced_at: "2026-08",
    steps: buildSteps("product_tour.cycle", ["step_zero", "step_one", "step_two", "step_three", "step_four"], {
      step_zero: CyclesTraining,
    }),
  },
  {
    key: "modules",
    i18n_title: "trainings.modules.modules.title",
    i18n_description: "trainings.modules.modules.description",
    icon: Boxes,
    introduced_at: "2026-08",
    steps: buildSteps("product_tour.module", ["step_zero", "step_one", "step_two", "step_three", "step_four"], {
      step_zero: ModulesTraining,
    }),
  },
  {
    key: "views",
    i18n_title: "trainings.modules.views.title",
    i18n_description: "trainings.modules.views.description",
    icon: ListFilter,
    introduced_at: "2026-08",
    steps: buildSteps("trainings.modules.views.steps", ["step_zero", "step_one", "step_two"], {
      step_zero: ViewsTraining,
    }),
  },
  {
    key: "pages",
    i18n_title: "trainings.modules.pages.title",
    i18n_description: "trainings.modules.pages.description",
    icon: FileText,
    introduced_at: "2026-08",
    steps: buildSteps(
      "product_tour.page",
      ["step_zero", "step_one", "step_two", "step_three", "step_four", "step_five"],
      { step_zero: PagesTraining }
    ),
  },
  {
    key: "intake",
    i18n_title: "trainings.modules.intake.title",
    i18n_description: "trainings.modules.intake.description",
    icon: Inbox,
    introduced_at: "2026-08",
    steps: buildSteps("product_tour.intake", ["step_zero", "step_one", "step_two", "step_three"]),
  },
  {
    key: "navigation",
    i18n_title: "trainings.modules.navigation.title",
    i18n_description: "trainings.modules.navigation.description",
    icon: Compass,
    introduced_at: "2026-08",
    steps: buildSteps("product_tour.navigation", ["step_zero", "step_one", "step_two"]),
  },
];
