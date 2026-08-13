/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { Button } from "@plane/propel/button";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import type { IOAuthApplication } from "@plane/types";
import { EModalPosition, EModalWidth, Input, ModalCore, TextArea } from "@plane/ui";
// hooks
import { useOAuthApplication } from "@/hooks/store";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  /** Absent when registering a new application. */
  application?: IOAuthApplication;
  onCreated: (application: IOAuthApplication) => void;
};

type FormValues = {
  name: string;
  redirect_uris: string;
};

export function OAuthApplicationForm(props: Props) {
  const { isOpen, handleClose, application, onCreated } = props;
  const { createApplication, updateApplication } = useOAuthApplication();
  const isEditing = Boolean(application);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: "", redirect_uris: "" },
  });

  useEffect(() => {
    if (isOpen) reset({ name: application?.name ?? "", redirect_uris: application?.redirect_uris ?? "" });
  }, [isOpen, application, reset]);

  const onSubmit = async (formData: FormValues) => {
    const payload = { name: formData.name.trim(), redirect_uris: formData.redirect_uris.trim() };
    try {
      if (application) {
        await updateApplication(application.id, payload);
        setToast({ type: TOAST_TYPE.SUCCESS, title: "Saved", message: `${payload.name} was updated.` });
        handleClose();
      } else {
        onCreated(await createApplication(payload));
      }
    } catch (error) {
      const message = (error as { error?: string })?.error ?? "Check the name and redirect URIs and try again.";
      setToast({ type: TOAST_TYPE.ERROR, title: "That did not work", message });
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose} position={EModalPosition.TOP} width={EModalWidth.XXL}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4 p-5">
          <h3 className="text-16 font-medium text-primary">
            {isEditing ? "Edit application" : "Register an application"}
          </h3>
          <div className="space-y-1">
            <label className="text-13 font-medium text-secondary" htmlFor="name">
              Name
            </label>
            <Controller
              control={control}
              name="name"
              rules={{ required: "Give the application a name." }}
              render={({ field: { value, onChange } }) => (
                <Input
                  id="name"
                  type="text"
                  value={value}
                  onChange={onChange}
                  hasError={Boolean(errors.name)}
                  placeholder="Plane MCP"
                  className="w-full"
                />
              )}
            />
            {errors.name && <p className="text-danger text-11">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-13 font-medium text-secondary" htmlFor="redirect_uris">
              Redirect URIs
            </label>
            <Controller
              control={control}
              name="redirect_uris"
              rules={{ required: "At least one redirect URI is required." }}
              render={({ field: { value, onChange } }) => (
                <TextArea
                  id="redirect_uris"
                  value={value}
                  onChange={onChange}
                  hasError={Boolean(errors.redirect_uris)}
                  placeholder="https://mcp.example.com/http/auth/callback"
                  className="w-full resize-none text-13"
                  rows={4}
                />
              )}
            />
            <p className="text-11 text-tertiary">
              One per line. They must match the client&apos;s callback exactly, and only http and https are accepted.
            </p>
            {errors.redirect_uris && <p className="text-danger text-11">{errors.redirect_uris.message}</p>}
          </div>
          {isEditing && (
            <p className="text-11 text-tertiary">
              The client ID stays the same, so deployed clients keep working. The secret cannot be changed or read back.
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-subtle px-5 py-4">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" type="submit" loading={isSubmitting}>
            {isEditing ? "Save changes" : "Register"}
          </Button>
        </div>
      </form>
    </ModalCore>
  );
}
