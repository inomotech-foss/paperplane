/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane imports
import { useTranslation } from "@plane/i18n";
import type { TPage } from "@plane/types";
import { getPageName } from "@plane/utils";
// components
import { DocumentEditor } from "@/components/editor/document/editor";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
// services
import { ProjectPageService } from "@/services/page";

const projectPageService = new ProjectPageService();

type Props = {
  /** The page whose content is shown. */
  sourcePageId: string | undefined;
  /** The page the block sits on. */
  hostPageId: string | undefined;
  /** Includes resolve within the host page's project, where the import put them. */
  projectId: string | undefined;
};

function Notice(props: { message: string }) {
  return (
    <div className="rounded-md border border-subtle px-3 py-2">
      <p className="text-13 text-tertiary">{props.message}</p>
    </div>
  );
}

/**
 * Another page's content, shown read-only in place: a Confluence "include
 * page" macro. The content is fetched, not copied, so an edit to the source
 * page shows everywhere it is included the next time the block loads (and when
 * the window regains focus).
 *
 * The nested editor gets no query block handler, so an include inside the
 * included page renders as an empty block rather than recursing.
 */
export const PageIncludeBlock = observer(function PageIncludeBlock(props: Props) {
  const { hostPageId, projectId, sourcePageId } = props;
  const { workspaceSlug } = useParams();
  const { getWorkspaceBySlug } = useWorkspace();
  const { t } = useTranslation();

  const slug = workspaceSlug?.toString() ?? "";
  const valid = !!sourcePageId && sourcePageId !== hostPageId;
  const { data, error, isLoading } = useSWR<TPage, unknown>(
    valid && slug && projectId ? ["PAGE_INCLUDE", slug, projectId, sourcePageId] : null,
    valid && slug && projectId ? () => projectPageService.fetchById(slug, projectId, sourcePageId, false) : null,
    { revalidateOnFocus: true }
  );

  if (!valid) return <Notice message={t("page_query_block.include.invalid")} />;
  if (isLoading) return <Notice message={t("page_query_block.include.loading")} />;
  if (error || !data) return <Notice message={t("page_query_block.include.error")} />;

  return (
    <div className="editor-include-block rounded-md border border-subtle">
      <DocumentEditor
        // a new body replaces the read-only editor rather than patching it
        key={`${sourcePageId}-${data.updated_at ?? ""}`}
        editable={false}
        id={`include-${hostPageId ?? ""}-${sourcePageId}`}
        value={data.description_html || "<p></p>"}
        containerClassName="p-0 pb-0 border-none"
        editorClassName="px-3"
        displayConfig={{ wideLayout: true }}
        projectId={projectId}
        workspaceId={getWorkspaceBySlug(slug)?.id ?? ""}
        workspaceSlug={slug}
      />
      <div className="border-t border-subtle px-3 py-1 text-11 text-tertiary">
        {t("page_query_block.include.source")}{" "}
        <Link href={`/${slug}/projects/${projectId}/pages/${sourcePageId}`} className="underline">
          {getPageName(data.name)}
        </Link>
      </div>
    </div>
  );
});
