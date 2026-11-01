/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Controller, useForm } from "react-hook-form";
import { Button } from "@makeplane/propel/components/button";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { useTranslation } from "@plane/i18n";
import type { IFormattedInstanceConfiguration, TInstanceAIConfigurationKeys } from "@plane/types";
// components
import type { TControllerInputFormField } from "@/components/common/controller-input";
import { ControllerInput } from "@/components/common/controller-input";
import { setToast } from "@plane/blocks/toast";
// hooks
import { useInstance } from "@/hooks/store";

type IInstanceAIForm = {
  config: IFormattedInstanceConfiguration;
};

type AIFormValues = Record<TInstanceAIConfigurationKeys, string>;

const LLM_PROVIDERS = { openai: "OpenAI", anthropic: "Anthropic", gemini: "Gemini" } as const;

type TLLMProvider = keyof typeof LLM_PROVIDERS;

const isLLMProvider = (value: string | null | undefined): value is TLLMProvider =>
  !!value && value in LLM_PROVIDERS;

export function InstanceAIForm(props: IInstanceAIForm) {
  const { config } = props;
  const { t } = useTranslation();
  // store
  const { updateInstanceConfigurations } = useInstance();
  const configuredProvider = config["LLM_PROVIDER"]?.toLowerCase();
  // form data
  const {
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AIFormValues>({
    defaultValues: {
      LLM_PROVIDER: isLLMProvider(configuredProvider) ? configuredProvider : "openai",
      LLM_API_KEY: config["LLM_API_KEY"],
      LLM_MODEL: config["LLM_MODEL"],
    },
  });

  const aiFormFields: TControllerInputFormField<AIFormValues>[] = [
    {
      key: "LLM_MODEL",
      type: "text",
      label: t("instance_ai.model.label"),
      description: t("instance_ai.model.description"),
      placeholder: t("instance_ai.model.placeholder"),
      error: Boolean(errors.LLM_MODEL),
      required: false,
    },
    {
      key: "LLM_API_KEY",
      type: "password",
      label: t("instance_ai.api_key.label"),
      description: t("instance_ai.api_key.description"),
      placeholder: "sk-...",
      error: Boolean(errors.LLM_API_KEY),
      required: false,
    },
  ];

  const onSubmit = async (formData: AIFormValues) => {
    const payload: Partial<AIFormValues> = { ...formData };

    await updateInstanceConfigurations(payload)
      .then(() =>
        setToast({
          type: "success",
          title: t("instance_ai.toast.success_title"),
          message: t("instance_ai.toast.success_message"),
        })
      )
      .catch((err: unknown) => console.error(err));
  };

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <div className="pb-1 text-18 font-medium text-primary">{t("instance_ai.title")}</div>
          <div className="text-13 font-regular text-tertiary">{t("instance_ai.description")}</div>
        </div>
        <div className="grid-col grid w-full grid-cols-1 items-start justify-between gap-x-12 gap-y-8 lg:grid-cols-3">
          <div className="flex flex-col gap-1">
            <h4 className="text-13 text-tertiary">{t("instance_ai.provider.label")}</h4>
            <Controller
              control={control}
              name="LLM_PROVIDER"
              render={({ field: { value, onChange } }) => (
                <Select
                  items={LLM_PROVIDERS}
                  value={isLLMProvider(value) ? value : "openai"}
                  onValueChange={(provider) => {
                    if (!isLLMProvider(provider) || provider === value) return;
                    onChange(provider);
                    // a model name of one provider never works with another
                    setValue("LLM_MODEL", "", { shouldDirty: true });
                  }}
                >
                  <SelectTrigger size="lg" placeholder={t("instance_ai.provider.label")} />
                  <SelectContent>
                    <SelectList>
                      {Object.entries(LLM_PROVIDERS).map(([key, label]) => (
                        <SelectItem key={key} value={key} label={label} size="lg" />
                      ))}
                    </SelectList>
                  </SelectContent>
                </Select>
              )}
            />
            <p className="text-11 text-tertiary">{t("instance_ai.provider.description")}</p>
          </div>
          {aiFormFields.map((field) => (
            <ControllerInput
              key={field.key}
              control={control}
              type={field.type}
              name={field.key}
              label={field.label}
              description={field.description}
              placeholder={field.placeholder}
              error={field.error}
              required={field.required}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col items-start gap-4">
        <Button
          variant="primary"
          size="md"
          stretch="auto"
          onClick={handleSubmit(onSubmit)}
          loading={isSubmitting}
          label={isSubmitting ? t("instance_ai.saving") : t("instance_ai.save")}
        />
      </div>
    </div>
  );
}
