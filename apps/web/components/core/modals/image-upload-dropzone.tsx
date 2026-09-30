/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { DropzoneState } from "react-dropzone";
import { Button } from "@makeplane/propel/components/button";
import {
  DialogActions,
  DialogBody,
  DialogHeader,
  DialogHeading,
  DialogInfo,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { UserOutline } from "@makeplane/propel/icons";
import { getFileURL } from "@plane/utils";

type Props = Pick<DropzoneState, "getRootProps" | "getInputProps" | "isDragActive" | "fileRejections"> & {
  title: string;
  image: File | null;
  value: string | null;
};

/** Dialog header and dropzone body shared by the user and workspace image upload modals. */
export function ImageUploadDropzone(props: Props) {
  const { getRootProps, getInputProps, isDragActive, fileRejections, title, image, value } = props;

  return (
    <DialogMain>
      <DialogHeader>
        <DialogHeading>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeading>
      </DialogHeader>
      <DialogBody tabIndex={0}>
        <div className="space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-3">
              <div
                {...getRootProps()}
                className={`relative grid h-80 w-80 cursor-pointer place-items-center rounded-lg p-12 text-center focus:ring-2 focus:ring-accent-strong focus:ring-offset-2 focus:outline-none ${
                  (image === null && isDragActive) || !value
                    ? "border-2 border-dashed border-subtle hover:bg-surface-2"
                    : ""
                }`}
              >
                {image !== null || (value && value !== "") ? (
                  <>
                    <button
                      type="button"
                      className="absolute top-0 right-0 z-40 translate-x-1/2 -translate-y-1/2 rounded-sm bg-surface-2 px-2 py-0.5 text-11 font-medium text-secondary"
                    >
                      Edit
                    </button>
                    <img
                      src={image ? URL.createObjectURL(image) : value ? getFileURL(value) : ""}
                      alt="Upload preview"
                      className="absolute top-0 left-0 h-full w-full rounded-md object-cover"
                    />
                  </>
                ) : (
                  <div>
                    <UserOutline className="mx-auto h-16 w-16 text-secondary" />
                    <span className="mt-2 block text-13 font-medium text-secondary">
                      {isDragActive ? "Drop image here to upload" : "Drag & drop image here"}
                    </span>
                  </div>
                )}

                <input {...getInputProps()} />
              </div>
            </div>
            {fileRejections.length > 0 && (
              <p className="text-13 text-danger-primary">
                {fileRejections[0].errors[0].code === "file-too-large"
                  ? "The image size cannot exceed 5 MB."
                  : "Please upload a file in a valid format."}
              </p>
            )}
          </div>
          <p className="text-13 text-secondary">File formats supported- .jpeg, .jpg, .png, .webp</p>
        </div>
      </DialogBody>
    </DialogMain>
  );
}

type TActionsProps = {
  hasValue: boolean;
  hasImage: boolean;
  isRemoving: boolean;
  isImageUploading: boolean;
  /** Show a spinner on the remove button while removing. */
  showRemoveLoading?: boolean;
  onRemove: () => void;
  onCancel: () => void;
  onSubmit: () => void;
};

/** Remove / cancel / upload actions shared by the user and workspace image upload modals. */
export function ImageUploadActions(props: TActionsProps) {
  const { hasValue, hasImage, isRemoving, isImageUploading, showRemoveLoading, onRemove, onCancel, onSubmit } = props;

  return (
    <DialogActions>
      <DialogInfo>
        <Button
          variant="danger"
          size="md"
          stretch="auto"
          label={isRemoving ? "Removing" : "Remove"}
          onClick={onRemove}
          disabled={!hasValue}
          loading={showRemoveLoading ? isRemoving : undefined}
        />
      </DialogInfo>
      <Button variant="secondary" size="md" stretch="auto" label="Cancel" onClick={onCancel} />
      <Button
        variant="primary"
        size="md"
        stretch="auto"
        label={isImageUploading ? "Uploading" : "Upload & Save"}
        onClick={onSubmit}
        disabled={!hasImage}
        loading={isImageUploading}
      />
    </DialogActions>
  );
}
