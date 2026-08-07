/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
// plane imports
import { Logo } from "@plane/propel/emoji-icon-picker";
import { PageIcon } from "@plane/propel/icons";
import { getPageName } from "@plane/utils";
// hooks
import type { EPageStoreType } from "@/hooks/store";
import { usePageStore } from "@/hooks/store";

type SubPageItemProps = {
  pageId: string;
  storeType: EPageStoreType;
};

export const SubPageItem = observer(function SubPageItem(props: SubPageItemProps) {
  const { pageId, storeType } = props;
  // store hooks
  const { getPageById } = usePageStore(storeType);
  // derived values
  const subPage = getPageById(pageId);

  if (!subPage) return null;

  return (
    <Link
      href={subPage.getRedirectionLink()}
      className="flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors hover:bg-layer-1"
    >
      <span className="flex flex-shrink-0 items-center">
        {subPage.logo_props?.in_use ? (
          <Logo logo={subPage.logo_props} size={14} type="lucide" />
        ) : (
          <PageIcon className="size-3.5 text-tertiary" />
        )}
      </span>
      <span className="truncate text-13 font-medium">{getPageName(subPage.name)}</span>
    </Link>
  );
});
