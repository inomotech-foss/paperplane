/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { DialogHeader, DialogHeading, DialogTitle } from "@makeplane/propel/components/dialog";
import { WarningTriangleOutline } from "@makeplane/propel/icons";

type Props = {
  title: string;
};

export function ProjectDangerDialogHeader({ title }: Props) {
  return (
    <DialogHeader>
      <div className="flex w-full items-center justify-start gap-6">
        <span className="place-items-center rounded-full bg-danger-subtle p-4">
          <WarningTriangleOutline className="h-6 w-6 text-danger-primary" aria-hidden="true" />
        </span>
        <DialogHeading>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeading>
      </div>
    </DialogHeader>
  );
}
