/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { ShowOutline, WarningTriangleOutline } from "@makeplane/propel/icons";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { setToast } from "@plane/blocks/toast";
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

/** Loads the previous version and builds the highlighted diff when comparing. */
const useVersionDiff = (args: {
  pageId: string;
  activeVersion: string | null;
  versionDetails: TPageVersion | undefined;
  isComparing: boolean;
  fetchAllVersions: Props["fetchAllVersions"];
  fetchVersionDetails: Props["fetchVersionDetails"];
}) => {
  const { pageId, activeVersion, versionDetails, isComparing, fetchAllVersions, fetchVersionDetails } = args;

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

  return { diffContent, compareEnabled };
};

function VersionLoadError(props: { onRetry: () => Promise<unknown> }) {
  const { onRetry } = props;
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry();
    setIsRetrying(false);
  };

  return (
    <div className="grid flex-grow place-items-center">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-11 flex-shrink-0 place-items-center text-tertiary">
          <WarningTriangleOutline className="size-10" />
        </span>
        <div>
          <h6 className="text-16 font-semibold">Something went wrong!</h6>
          <p className="text-13 text-tertiary">The version could not be loaded, please try again.</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          stretch="auto"
          label="Try again"
          onClick={() => void handleRetry()}
          loading={isRetrying}
        />
      </div>
    </div>
  );
}

function VersionHeaderActions(props: {
  compareEnabled: boolean;
  isComparing: boolean;
  onToggleCompare: () => void;
  restoreEnabled: boolean;
  isRestoring: boolean;
  onRestore: () => void;
}) {
  const { compareEnabled, isComparing, onToggleCompare, restoreEnabled, isRestoring, onRestore } = props;
  const { t } = useTranslation();
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      {compareEnabled && (
        <Button
          variant={isComparing ? "primary" : "secondary"}
          size="sm"
          stretch="auto"
          aria-pressed={isComparing}
          label={t("page_navigation_pane.tabs.info.version_history.highlight_changes")}
          onClick={onToggleCompare}
        />
      )}
      {restoreEnabled && (
        <Button
          variant="primary"
          size="sm"
          stretch="auto"
          label={isRestoring ? "Restoring" : "Restore"}
          onClick={onRestore}
          loading={isRestoring}
        />
      )}
    </div>
  );
}

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
  const [isComparing, setIsComparing] = useState(false);

  const {
    data: versionDetails,
    error: versionDetailsError,
    mutate: mutateVersionDetails,
  } = useSWR(
    pageId && activeVersion ? `PAGE_VERSION_${activeVersion}` : null,
    pageId && activeVersion ? () => fetchVersionDetails(pageId, activeVersion) : null
  );

  const { diffContent, compareEnabled } = useVersionDiff({
    pageId,
    activeVersion,
    versionDetails,
    isComparing,
    fetchAllVersions,
    fetchVersionDetails,
  });

  const handleRestoreVersion = async () => {
    if (!restoreEnabled) return;
    setIsRestoring(true);
    try {
      await handleRestore(versionDetails?.description_html ?? "<p></p>");
      setToast({
        type: "success",
        title: "Page version restored.",
      });
      handleClose();
    } catch {
      setToast({
        type: "error",
        title: "Failed to restore page version.",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const VersionEditor = editorComponent;

  if (versionDetailsError) {
    return (
      <div className="flex flex-grow flex-col overflow-hidden">
        <VersionLoadError onRetry={() => mutateVersionDetails()} />
      </div>
    );
  }

  return (
    <div className="flex flex-grow flex-col overflow-hidden">
      <div className="flex min-h-14 items-center justify-between gap-2 border-b border-subtle px-5 py-3">
        <div className="flex items-center gap-4">
          <h6 className="text-14 font-medium">
            {versionDetails
              ? `${renderFormattedDate(versionDetails.last_saved_at)} ${renderFormattedTime(versionDetails.last_saved_at)}`
              : "Loading version details"}
          </h6>
          <span className="flex flex-shrink-0 items-center gap-1 rounded-sm bg-accent-primary/20 px-1.5 py-1 text-11 font-medium text-accent-primary">
            <ShowOutline className="size-3 flex-shrink-0" />
            View only
          </span>
        </div>
        <VersionHeaderActions
          compareEnabled={compareEnabled}
          isComparing={isComparing}
          onToggleCompare={() => setIsComparing((previous) => !previous)}
          restoreEnabled={restoreEnabled}
          isRestoring={isRestoring}
          onRestore={() => void handleRestoreVersion()}
        />
      </div>
      <div className="vertical-scrollbar scrollbar-sm h-full overflow-y-scroll pt-8">
        <VersionEditor
          activeVersion={activeVersion}
          diffContent={diffContent}
          storeType={storeType}
          versionDetails={versionDetails}
        />
      </div>
    </div>
  );
});
