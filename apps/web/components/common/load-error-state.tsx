// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { WarningTriangleOutline } from "@makeplane/propel/icons";
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";

/** Shown in place of content that failed to load or render. */
export function LoadErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();

  return (
    <div role="alert" className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
      <WarningTriangleOutline className="size-8 text-tertiary" />
      <p className="text-14 text-secondary">{t("something_went_wrong")}</p>
      <Button variant="secondary" size="xs" stretch="auto" label={t("common.retry")} onClick={onRetry} />
    </div>
  );
}
