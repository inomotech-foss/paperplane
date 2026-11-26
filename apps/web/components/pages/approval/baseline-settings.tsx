/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
// components
import { SettingsBoxedControlItem } from "@/components/settings/boxed-control-item";
// services
import { PageApprovalService } from "@/services/page";
import type { TPageBaselinePreview } from "@/services/page/page-approval.service";
// store
import { eligibleCount } from "@/store/pages/page-baseline";
// local imports
import { PageBaselineModal, baselinePreviewKey } from "./baseline-modal";

const service = new PageApprovalService();

type Props = {
  workspaceSlug: string;
  projectId: string;
};

/** Puts the current content of existing pages in force, for projects that switch approvals on late. */
export const PageBaselineSettings = observer(function PageBaselineSettings(props: Props) {
  const { workspaceSlug, projectId } = props;
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { data: preview, error } = useSWR<TPageBaselinePreview, unknown>(
    baselinePreviewKey(projectId),
    () => service.baselinePreview(workspaceSlug, projectId),
    { revalidateOnFocus: false }
  );
  const available = preview ? eligibleCount(preview.totals, true) : 0;

  let status = "";
  if (error) status = t("page_approval_baseline.load_failed");
  else if (preview)
    status = available
      ? t("page_approval_baseline.eligible", { count: available })
      : t("page_approval_baseline.none_eligible");

  return (
    <>
      <SettingsBoxedControlItem
        title={t("page_approval_baseline.title")}
        description={
          <>
            {t("page_approval_baseline.description")} {status}
          </>
        }
        control={
          <Button
            variant="secondary"
            size="md"
            stretch="auto"
            disabled={available === 0}
            onClick={() => setIsModalOpen(true)}
            label={t("page_approval_baseline.open")}
          />
        }
      />
      <PageBaselineModal
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        preview={preview}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
});
