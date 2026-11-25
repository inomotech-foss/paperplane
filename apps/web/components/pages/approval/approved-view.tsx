/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import type { TPageVersion } from "@plane/types";
// components
import { PagesVersionEditor } from "@/components/pages/version/editor";
// hooks
import type { EPageStoreType } from "@/hooks/store";

type Props = {
  approvedVersionId: string;
  fetchVersionDetails: (pageId: string, versionId: string) => Promise<TPageVersion | undefined>;
  pageId: string;
  storeType: EPageStoreType;
};

/**
 * The version in force, read-only, in place of the collaborative editor.
 *
 * It is a frozen version rather than a live document, rendered the way the version history
 * previews one, so readers never see someone's half-typed draft.
 */
export const PageApprovedVersionView = observer(function PageApprovedVersionView(props: Props) {
  const { approvedVersionId, fetchVersionDetails, pageId, storeType } = props;
  // shares its key with the version history, which caches versions by id
  const { data: versionDetails } = useSWR(`PAGE_VERSION_${approvedVersionId}`, () =>
    fetchVersionDetails(pageId, approvedVersionId)
  );

  return (
    <div className="vertical-scrollbar scrollbar-sm size-full overflow-y-auto pt-8">
      <PagesVersionEditor activeVersion={approvedVersionId} storeType={storeType} versionDetails={versionDetails} />
    </div>
  );
});
