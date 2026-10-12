/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo } from "react";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";
// local imports
import { PAGE_DRAG_BLOCK_I18N_KEYS } from "./page-drag-block";
import type { TBlockedPageDrag } from "./use-page-tree-dnd";

type Props = {
  blockedDrag: TBlockedPageDrag;
};

/** Says why a page cannot be dragged, next to the pointer that tried. */
export function PageDragBlockedHint(props: Props) {
  const { blockedDrag } = props;
  const { t } = useTranslation();
  const { reason, x, y } = blockedDrag;
  const anchor = useMemo(() => ({ getBoundingClientRect: () => new DOMRect(x, y, 0, 0) }), [x, y]);

  return (
    <Tooltip label={t(PAGE_DRAG_BLOCK_I18N_KEYS[reason])} open anchor={anchor}>
      <span aria-hidden className="pointer-events-none absolute size-0" />
    </Tooltip>
  );
}
