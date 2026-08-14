/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { EyeIcon, TriangleAlert } from "lucide-react";
// plane imports
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { JSONContent, TPageVersion } from "@plane/types";
import { isJSONContentEmpty, renderFormattedDate, renderFormattedTime } from "@plane/utils";
// helpers
import type { EPageStoreType } from "@/hooks/store";
// local imports
import { buildPageVersionDiff } from "./diff";
import type { TVersionEditorProps } from "./editor";

type Props = {
  activeVersion: string | null;
  editorComponent: React.FC<TVersionEditorProps>;
  fetchAllVersions: (pageId: string) => Promise<TPageVersion[] | undefined>;
  fetchVersionDetails: (pageId: string, versionId: string) => Promise<TPageVersion | undefined>;
  handleClose: () => void;
  handleRestore: (descriptionHTML: string) => Promise<void>;
  pageId: string;
  restoreEnabled: boolean;
  storeType: EPageStoreType;
};

/** The version saved immediately before the one being viewed. */
const previousVersionId = (versions: TPageVersion[] | undefined, activeVersion: string | null): string | null => {
  const active = versions?.find((version) => version.id === activeVersion);
  if (!versions || !active) return null;

  const activeSavedAt = Date.parse(active.last_saved_at);
  let previous: TPageVersion | null = null;
  for (const version of versions) {
    const savedAt = Date.parse(version.last_saved_at);
    if (savedAt >= activeSavedAt) continue;
    if (!previous || savedAt > Date.parse(previous.last_saved_at)) previous = version;
  }
  return previous?.id ?? null;
};

export const PageVersionsMainContent = observer(function PageVersionsMainContent(props: Props) {
  const {
    activeVersion,
    editorComponent,
    fetchAllVersions,
    fetchVersionDetails,
    handleClose,
    handleRestore,
    pageId,
    restoreEnabled,
    storeType,
  } = props;
  // states
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isComparing, setIsComparing] = useState(false);
  // translation
  const { t } = useTranslation();

  const {
    data: versionDetails,
    error: versionDetailsError,
    mutate: mutateVersionDetails,
  } = useSWR(
    pageId && activeVersion ? `PAGE_VERSION_${activeVersion}` : null,
    pageId && activeVersion ? () => fetchVersionDetails(pageId, activeVersion) : null
  );

  // shares its key with the navigation pane timeline, so this is usually cached
  const { data: versionsList } = useSWR(
    pageId ? `PAGE_VERSIONS_LIST_${pageId}` : null,
    pageId ? () => fetchAllVersions(pageId) : null
  );

  const previousVersion = previousVersionId(versionsList, activeVersion);

  const { data: previousVersionDetails } = useSWR(
    pageId && previousVersion && isComparing ? `PAGE_VERSION_${previousVersion}` : null,
    pageId && previousVersion ? () => fetchVersionDetails(pageId, previousVersion) : null
  );

  // Both sides have to be in hand, or a still-loading fetch reads as a full rewrite.
  const diffContent = useMemo(() => {
    if (!isComparing || !versionDetails || !previousVersionDetails) return null;
    const current = versionDetails.description_json as JSONContent | undefined;
    if (isJSONContentEmpty(current)) return null;
    return buildPageVersionDiff(previousVersionDetails.description_json as JSONContent | undefined, current);
  }, [isComparing, previousVersionDetails, versionDetails]);

  const compareEnabled = !!previousVersion && !isJSONContentEmpty(versionDetails?.description_json as JSONContent);

  const handleRestoreVersion = async () => {
    if (!restoreEnabled) return;
    setIsRestoring(true);
    try {
      await handleRestore(versionDetails?.description_html ?? "<p></p>");
      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Page version restored.",
      });
      handleClose();
    } catch {
      setToast({
        type: TOAST_TYPE.ERROR,
        title: "Failed to restore page version.",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleRetry = async () => {
    setIsRetrying(true);
    await mutateVersionDetails();
    setIsRetrying(false);
  };

  const VersionEditor = editorComponent;

  return (
    <div className="flex flex-grow flex-col overflow-hidden">
      {versionDetailsError ? (
        <div className="grid flex-grow place-items-center">
          <div className="flex flex-col items-center gap-4 text-center">
            <span className="grid size-11 flex-shrink-0 place-items-center text-tertiary">
              <TriangleAlert className="size-10" />
            </span>
            <div>
              <h6 className="text-16 font-semibold">Something went wrong!</h6>
              <p className="text-13 text-tertiary">The version could not be loaded, please try again.</p>
            </div>
            <Button variant="link" onClick={handleRetry} loading={isRetrying}>
              Try again
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-h-14 items-center justify-between gap-2 border-b border-subtle px-5 py-3">
            <div className="flex items-center gap-4">
              <h6 className="text-14 font-medium">
                {versionDetails
                  ? `${renderFormattedDate(versionDetails.last_saved_at)} ${renderFormattedTime(versionDetails.last_saved_at)}`
                  : "Loading version details"}
              </h6>
              <span className="flex flex-shrink-0 items-center gap-1 rounded-sm bg-accent-primary/20 px-1.5 py-1 text-11 font-medium text-accent-primary">
                <EyeIcon className="size-3 flex-shrink-0" />
                View only
              </span>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              {compareEnabled && (
                <Button
                  variant={isComparing ? "primary" : "secondary"}
                  aria-pressed={isComparing}
                  onClick={() => setIsComparing((previous) => !previous)}
                >
                  {t("page_navigation_pane.tabs.info.version_history.highlight_changes")}
                </Button>
              )}
              {restoreEnabled && (
                <Button variant="primary" onClick={handleRestoreVersion} loading={isRestoring}>
                  {isRestoring ? "Restoring" : "Restore"}
                </Button>
              )}
            </div>
          </div>
          <div className="vertical-scrollbar scrollbar-sm h-full overflow-y-scroll pt-8">
            <VersionEditor
              activeVersion={activeVersion}
              diffContent={diffContent}
              storeType={storeType}
              versionDetails={versionDetails}
            />
          </div>
        </>
      )}
    </div>
  );
});
