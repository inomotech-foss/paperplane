/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React, { useRef, useState } from "react";
import { observer } from "mobx-react";
import { useForm, Controller } from "react-hook-form";
// plane imports
import type { EditorRefApi } from "@plane/editor";
import { setToast } from "@plane/blocks/toast";
// editor components
import { LiteTextEditor } from "@/components/editor/lite-text-editor";
// hooks
import { usePublish } from "@/hooks/store/publish";
import { useIssueDetails } from "@/hooks/store/use-issue-details";
import { useUser } from "@/hooks/store/use-user";
// services
import { PublicFileService } from "@/services/file.service";
// types
import type { TCommentUpdate } from "@/store/issue-detail.store";

const fileService = new PublicFileService();

const defaultValues: TCommentUpdate = {
  comment_html: "",
};

type Props = {
  anchor: string;
  disabled?: boolean;
};

export const AddComment = observer(function AddComment(props: Props) {
  const { anchor } = props;
  // states
  const [uploadedAssetIds, setUploadAssetIds] = useState<string[]>([]);
  // refs
  const editorRef = useRef<EditorRefApi>(null);
  // store hooks
  const { peekId: issueId, addIssueComment, uploadCommentAsset } = useIssueDetails();
  const { data: currentUser } = useUser();
  const { workspace: workspaceID } = usePublish(anchor);
  // form info
  const {
    handleSubmit,
    control,
    watch,
    formState: { isSubmitting },
    reset,
  } = useForm<TCommentUpdate>({ defaultValues });

  const onSubmit = async (formData: TCommentUpdate) => {
    if (!anchor || !issueId || isSubmitting || !formData.comment_html) return;

    await addIssueComment(anchor, issueId, formData)
      .then(async (res) => {
        reset(defaultValues);
        editorRef.current?.clearEditor();
        if (uploadedAssetIds.length > 0) {
          await fileService.updateBulkAssetsUploadStatus(anchor, res.id, {
            asset_ids: uploadedAssetIds,
          });
          setUploadAssetIds([]);
        }
      })
      .catch(() =>
        setToast({
          type: "error",
          title: "Error!",
          message: "Comment could not be posted. Please try again.",
        })
      );
  };

  // TODO: on click if he user is not logged in redirect to login page
  return (
    <div>
      <div className="issue-comments-section">
        <Controller
          name="comment_html"
          control={control}
          render={({ field: { value, onChange } }) => (
            <LiteTextEditor
              editable
              onEnterKeyPress={(e) => {
                if (currentUser) handleSubmit(onSubmit)(e);
              }}
              anchor={anchor}
              workspaceId={workspaceID?.toString() ?? ""}
              ref={editorRef}
              id="peek-overview-add-comment"
              initialValue={value || watch("comment_html")}
              onChange={(comment_json, comment_html) => onChange(comment_html)}
              isSubmitting={isSubmitting}
              placeholder="Add comment..."
              uploadFile={async (blockId, file) => {
                const { asset_id } = await uploadCommentAsset(file, anchor);
                setUploadAssetIds((prev) => [...prev, asset_id]);
                return asset_id;
              }}
              displayConfig={{
                fontSize: "small-font",
              }}
            />
          )}
        />
      </div>
    </div>
  );
});
