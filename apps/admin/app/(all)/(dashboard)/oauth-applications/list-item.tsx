/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { Pencil, Trash2 } from "lucide-react";
// plane imports
import type { IOAuthApplication } from "@plane/types";
import { renderFormattedDate } from "@plane/utils";
// hooks
import { useOAuthApplication } from "@/hooks/store";

type Props = {
  applicationId: number;
  onEdit: (application: IOAuthApplication) => void;
  onRevoke: (application: IOAuthApplication) => void;
};

export const OAuthApplicationListItem = observer(function OAuthApplicationListItem(props: Props) {
  const { applicationId, onEdit, onRevoke } = props;
  const { getApplicationById } = useOAuthApplication();
  const application = getApplicationById(applicationId);

  if (!application) return null;

  const uris = application.redirect_uris.split("\n").filter(Boolean);

  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-subtle bg-layer-1 p-4">
      <div className="min-w-0 space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-14 font-medium">{application.name}</h3>
          <span className="text-11 text-tertiary">
            {application.installations === 1 ? "1 grant" : `${application.installations} grants`}
          </span>
          {application.managed && (
            <span className="rounded-xs bg-layer-1 px-2 text-11 font-medium text-placeholder">Chart-managed</span>
          )}
        </div>
        <p className="font-mono truncate text-11 text-tertiary">{application.client_id}</p>
        <div className="space-y-0.5">
          {uris.map((uri) => (
            <p key={uri} className="truncate text-11 text-tertiary">
              {uri}
            </p>
          ))}
        </div>
        <p className="text-11 text-placeholder">Registered {renderFormattedDate(application.created)}</p>
      </div>
      {application.managed ? (
        // Editing it here would be undone by the next deploy.
        <p className="max-w-56 flex-shrink-0 text-11 text-placeholder">Edit this in your chart values.</p>
      ) : (
        <div className="flex flex-shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(application)}
            className="rounded p-2 text-tertiary outline-none hover:bg-layer-1-hover"
            aria-label={`Edit ${application.name}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onRevoke(application)}
            className="hover:text-danger rounded p-2 text-tertiary outline-none hover:bg-layer-1-hover"
            aria-label={`Revoke ${application.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
});
