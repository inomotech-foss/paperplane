// SPDX-License-Identifier: AGPL-3.0-only

import type { CollaborationState } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { Banner } from "@makeplane/propel/components/banner";
import { isSyncTimeout } from "@/lib/collaboration-stage";

type Props = {
  collaborationState: CollaborationState | null;
};

export function PageSyncTimeoutBanner({ collaborationState }: Props) {
  const { t } = useTranslation();
  if (!isSyncTimeout(collaborationState)) return null;
  return <Banner placement="page" variant="warning" title={t("page_sync_timeout_banner.message")} />;
}
