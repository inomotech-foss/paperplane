/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react";
// plane imports
import type { TDiagramEditorProps, TFileHandler } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { EModalWidth, ModalCore } from "@plane/ui";
// hooks
import { useInstance } from "@/hooks/store/use-instance";
// services
import { PageAttachmentService } from "@/services/page";

const pageAttachmentService = new PageAttachmentService();

const DEFAULT_EMBED_ORIGIN = "https://embed.diagrams.net";

/**
 * `proto=json` selects the postMessage protocol this component speaks, and
 * `saveAndExit=1` collapses draw.io's save and exit buttons into the single
 * action a modal editor wants.
 */
const EMBED_PARAMS = "embed=1&proto=json&spin=1&modified=unsavedChanges&saveAndExit=1";

// A blank draw.io document, so a diagram whose source was never stored still opens.
const EMPTY_DIAGRAM =
  '<mxfile><diagram><mxGraphModel><root><mxCell id="0" /><mxCell id="1" parent="0" /></root></mxGraphModel></diagram></mxfile>';

type Props = TDiagramEditorProps & {
  pageId: string;
  projectId: string;
  uploadPreview: TFileHandler["upload"];
  workspaceSlug: string;
};

type TEmbedMessage = {
  event?: string;
  xml?: string;
  data?: string;
};

async function toPngFile(dataUri: string, name: string): Promise<File> {
  const blob = await (await fetch(dataUri)).blob();
  return new File([blob], name, { type: "image/png" });
}

/** The rendered size, which the node uses to reserve the right aspect ratio. */
function measure(dataUri: string): Promise<{ width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const image = new Image();
    image.addEventListener("load", () => resolve({ width: image.naturalWidth, height: image.naturalHeight }));
    // A diagram whose size cannot be read still saves; the node just renders it
    // without reserving space first.
    image.addEventListener("error", () => resolve({ width: null, height: null }));
    image.src = dataUri;
  });
}

export const PageDiagramEditor = observer(function PageDiagramEditor(props: Props) {
  const { assetId, onClose, onSave, pageId, projectId, title, uploadPreview, workspaceSlug } = props;
  // store hooks
  const { config } = useInstance();
  const { t } = useTranslation();
  // state
  const [source, setSource] = useState<string>();
  // refs
  const frameRef = useRef<HTMLIFrameElement>(null);
  // Saving is a two-step exchange with the embed, so the xml arrives one message
  // before the preview that has to be stored alongside it.
  const pendingXmlRef = useRef<string>();
  // draw.io exits by itself once a save completes; that exit is not the user
  // abandoning the edit and must not be handled as one.
  const isSavingRef = useRef(false);

  const origin = config?.diagram_embed_origin || DEFAULT_EMBED_ORIGIN;
  const name = title || "diagram";

  const post = useCallback(
    (payload: object) => {
      frameRef.current?.contentWindow?.postMessage(JSON.stringify(payload), origin);
    },
    [origin]
  );

  const store = useCallback(
    async (xml: string, preview: string) => {
      const [previewFile, size] = await Promise.all([toPngFile(preview, `${name}.png`), measure(preview)]);
      const [attachment, previewAssetId] = await Promise.all([
        // The source is a document a reader may want to take away, so it belongs
        // in the attachments tab. The preview is a render artefact and goes in as
        // an inline editor asset, the same split the Confluence import makes.
        pageAttachmentService.upload(
          workspaceSlug,
          projectId,
          pageId,
          new File([xml], `${name}.drawio`, { type: "application/xml" })
        ),
        uploadPreview(pageId, previewFile),
      ]);
      onSave({
        asset_id: attachment.id,
        preview_asset_id: previewAssetId,
        width: size.width,
        height: size.height,
      });
    },
    [name, onSave, pageId, projectId, uploadPreview, workspaceSlug]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!assetId) {
        setSource(EMPTY_DIAGRAM);
        return;
      }
      try {
        const xml = await pageAttachmentService.readContent(workspaceSlug, projectId, pageId, assetId);
        if (active) setSource(xml);
      } catch (error) {
        console.error("Error reading diagram source:", error);
        // Opening on a blank canvas would let the next save overwrite a source
        // that is still perfectly good, so give up instead.
        if (active) {
          setToast({ type: TOAST_TYPE.ERROR, title: t("page_diagram.load_error") });
          onClose();
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [assetId, onClose, pageId, projectId, t, workspaceSlug]);

  useEffect(() => {
    if (source === undefined) return;

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== origin || typeof event.data !== "string") return;

      let message: TEmbedMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }

      if (message.event === "init") {
        post({ action: "load", xml: source, autosave: 0 });
        return;
      }

      if (message.event === "save" && message.xml) {
        isSavingRef.current = true;
        pendingXmlRef.current = message.xml;
        post({ action: "export", format: "png", xml: message.xml, spinKey: "saving" });
        return;
      }

      if (message.event === "export" && message.data) {
        const xml = pendingXmlRef.current;
        if (!xml) return;
        pendingXmlRef.current = undefined;
        store(xml, message.data).catch((error) => {
          console.error("Error saving diagram:", error);
          isSavingRef.current = false;
          setToast({ type: TOAST_TYPE.ERROR, title: t("page_diagram.save_error") });
        });
        return;
      }

      if (message.event === "exit" && !isSavingRef.current) {
        onClose();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onClose, origin, post, source, store, t]);

  return (
    <ModalCore isOpen handleClose={onClose} width={EModalWidth.VIIXL} className="h-[85vh]">
      {source !== undefined && (
        <iframe
          ref={frameRef}
          src={`${origin}/?${EMBED_PARAMS}`}
          title={t("page_diagram.editor_title")}
          // draw.io is a full application: it needs scripts, its own storage, its
          // own dialogs, and it opens shape libraries and help in new tabs. The
          // rule flags allow-scripts with allow-same-origin because a same-origin
          // frame can then drop its own sandbox; this frame is on a different
          // origin, so the pair only grants draw.io its own origin, never ours.
          // What the sandbox still withholds is allow-top-navigation, which is
          // the part worth keeping.
          // oxlint-disable-next-line react/iframe-missing-sandbox
          sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
          className="size-full rounded-lg border-0"
        />
      )}
    </ModalCore>
  );
});
