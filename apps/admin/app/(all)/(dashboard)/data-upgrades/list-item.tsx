/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { Badge } from "@makeplane/propel/components/badge";
import type { BadgeVariant } from "@makeplane/propel/components/badge";
import { Button } from "@makeplane/propel/components/button";
import { Collapsible } from "@makeplane/propel/components/collapsible";
import { formatDataUpgradeCounts } from "@plane/services";
import type { TDataUpgrade, TDataUpgradeStatus } from "@plane/services";
import { renderFormattedDate } from "@plane/utils";

const STATUS_BADGE: Record<TDataUpgradeStatus, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pending", variant: "neutral" },
  running: { label: "Running", variant: "info" },
  done: { label: "Done", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

const formatTime = (value: string | null) =>
  value ? renderFormattedDate(new Date(value), "MMM dd, yyyy HH:mm") : undefined;

type Props = {
  upgrade: TDataUpgrade;
  isRetrying: boolean;
  onRetry: (name: string) => void;
};

export function DataUpgradeListItem({ upgrade, isRetrying, onRetry }: Props) {
  const status = STATUS_BADGE[upgrade.status];
  const details = [
    { label: "Counts", value: formatDataUpgradeCounts(upgrade.counts) || "None yet" },
    { label: "Started", value: formatTime(upgrade.started_at) ?? "Not started" },
    { label: "Finished", value: formatTime(upgrade.finished_at) ?? "Not finished" },
    { label: "Attempts", value: String(upgrade.attempts) },
  ];

  return (
    <div className="space-y-3 rounded-lg border border-subtle bg-layer-1 p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-mono truncate text-13 font-medium">{upgrade.name}</h3>
            <Badge size="xs" variant={status.variant} label={status.label} />
          </div>
          <p className="text-13 text-secondary">{upgrade.description}</p>
        </div>
        {upgrade.status === "failed" && (
          <Button
            variant="secondary"
            size="sm"
            stretch="auto"
            label="Retry"
            loading={isRetrying}
            onClick={() => onRetry(upgrade.name)}
          />
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-11 md:grid-cols-4">
        {details.map((detail) => (
          <div key={detail.label} className="min-w-0">
            <dt className="text-tertiary">{detail.label}</dt>
            <dd className="text-secondary">{detail.value}</dd>
          </div>
        ))}
      </dl>
      {upgrade.status === "failed" && upgrade.error && (
        <Collapsible trigger="Show error">
          <pre className="font-mono max-h-80 overflow-auto rounded-md border border-subtle bg-surface-2 p-3 text-11 whitespace-pre text-secondary">
            {upgrade.error}
          </pre>
        </Collapsible>
      )}
    </div>
  );
}
