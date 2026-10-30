/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { TDisplayConfig } from "@plane/editor";
import type { JSONContent, TPageVersion } from "@plane/types";
import { isJSONContentEmpty } from "@plane/utils";
// components
import { DocumentEditor } from "@/components/editor/document/editor";
import { EditorContentLoader } from "@/components/pages/loaders/editor-content-loader";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { usePageFilters } from "@/hooks/use-page-filters";
// plane web hooks
import { toJSONContent } from "./json-content";
import type { EPageStoreType } from "@/hooks/store";

export type TVersionEditorProps = {
  activeVersion: string | null;
  /** A merged diff document, rendered instead of the version itself. */
  diffContent?: JSONContent | null;
  versionDetails: TPageVersion | undefined;
  storeType: EPageStoreType;
};

export const PagesVersionEditor = observer(function PagesVersionEditor(props: TVersionEditorProps) {
  const { activeVersion, diffContent, versionDetails } = props;
  // params
  const { workspaceSlug, projectId } = useParams();
  // store hooks
  const { getWorkspaceBySlug } = useWorkspace();
  // derived values
  const workspaceDetails = getWorkspaceBySlug(workspaceSlug?.toString() ?? "");
  // page filters
  const { fontSize, fontStyle } = usePageFilters();

  const displayConfig: TDisplayConfig = {
    fontSize,
    fontStyle,
    wideLayout: true,
  };

  if (!versionDetails)
    return (
      <div className="size-full px-5">
        <EditorContentLoader />
      </div>
    );

  const versionDescription = isJSONContentEmpty(toJSONContent(versionDetails?.description_json))
    ? versionDetails?.description_html
    : versionDetails?.description_json;
  const description = diffContent ?? versionDescription;

  if (!description) return null;

  return (
    <DocumentEditor
      key={`${activeVersion ?? ""}-${diffContent ? "diff" : "original"}`}
      editable={false}
      id={activeVersion ?? ""}
      value={description}
      containerClassName="p-0 pb-64 border-none"
      displayConfig={displayConfig}
      editorClassName="pl-10"
      projectId={projectId?.toString()}
      workspaceId={workspaceDetails?.id ?? ""}
      workspaceSlug={workspaceSlug?.toString() ?? ""}
    />
  );
});
