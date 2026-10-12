/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { useParams } from "next/navigation";
// Plane imports
import type { IWebhook } from "@plane/types";
import { Switch } from "@makeplane/propel/components/switch";
// hooks
import { useWebhook } from "@/hooks/store/use-webhook";

interface IWebhookListItem {
  webhook: IWebhook;
}

export function WebhooksListItem(props: IWebhookListItem) {
  const { webhook } = props;
  // router
  const { workspaceSlug } = useParams();
  // store hooks
  const { updateWebhook } = useWebhook();

  const handleToggle = async () => {
    if (!workspaceSlug || !webhook.id) return;
    await updateWebhook(workspaceSlug.toString(), webhook.id, { is_active: !webhook.is_active });
  };

  return (
    <div className="relative flex items-center justify-between gap-4 rounded-lg border border-subtle bg-layer-2 px-4 py-3">
      <Link
        href={`/${workspaceSlug}/settings/webhooks/${webhook?.id}`}
        className="truncate after:absolute after:inset-0"
      >
        <h5 className="truncate text-body-sm-medium">{webhook.url}</h5>
      </Link>
      <div className="relative z-[1] shrink-0">
        <Switch
          size="sm"
          checked={webhook.is_active}
          onCheckedChange={() => {
            void handleToggle();
          }}
          aria-label="Toggle webhook"
        />
      </div>
    </div>
  );
}
