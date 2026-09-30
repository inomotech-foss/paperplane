/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import { setToast } from "@plane/blocks/toast";
import type { IOAuthApplication } from "@plane/types";
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
        setToast({ type: "success", title: "Saved", message: `${payload.name} was updated.` });
        handleClose();
      } else {
        onCreated(await createApplication(payload));
      }
    } catch (error) {
      const message = (error as { error?: string })?.error ?? "Check the name and redirect URIs and try again.";
      setToast({ type: "error", title: "That did not work", message });
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogMain>
            <DialogHeader>
              <DialogHeading>
                <DialogTitle>{isEditing ? "Edit application" : "Register an application"}</DialogTitle>
              </DialogHeading>
            </DialogHeader>
            <DialogBody>
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-13 font-medium text-secondary" htmlFor="name">
                    Name
                  </label>
                  <Controller
                    control={control}
                    name="name"
                    rules={{ required: "Give the application a name." }}
                    render={({ field: { value, onChange } }) => (
                      <Field name="name" invalid={Boolean(errors.name)}>
                        <InputGroup size="lg">
                          <Input
                            size="lg"
                            id="name"
                            type="text"
                            value={value}
                            onChange={onChange}
                            placeholder="Plane MCP"
                          />
                        </InputGroup>
                      </Field>
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
                      <Field name="redirect_uris" invalid={Boolean(errors.redirect_uris)}>
                        <TextAreaGroup resize="none">
                          <TextArea
                            size="md"
                            surface="field"
                            id="redirect_uris"
                            value={value}
                            onChange={onChange}
                            placeholder="https://mcp.example.com/http/auth/callback"
                            rows={4}
                          />
                        </TextAreaGroup>
                      </Field>
                    )}
                  />
                  <p className="text-11 text-tertiary">
                    One per line. They must match the client&apos;s callback exactly, and only http and https are
                    accepted.
                  </p>
                  {errors.redirect_uris && <p className="text-danger text-11">{errors.redirect_uris.message}</p>}
                </div>
                {isEditing && (
                  <p className="text-11 text-tertiary">
                    The client ID stays the same, so deployed clients keep working. The secret cannot be changed or read
                    back.
                  </p>
                )}
              </div>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button variant="secondary" size="md" stretch="auto" onClick={handleClose} label="Cancel" />
            <Button
              variant="primary"
              size="md"
              stretch="auto"
              type="submit"
              loading={isSubmitting}
              label={isEditing ? "Save changes" : "Register"}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
}
