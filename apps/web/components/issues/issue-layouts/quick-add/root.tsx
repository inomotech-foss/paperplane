/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { FC } from "react";
import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import type { UseFormRegister } from "react-hook-form";
import { useForm } from "react-hook-form";
// plane imports
import { useTranslation } from "@plane/i18n";
import { AddOutline } from "@makeplane/propel/icons";
import { setPromiseToast } from "@plane/blocks/toast";
import type { IProject, TIssue, EIssueLayoutTypes } from "@plane/types";
import { cn, createIssuePayload } from "@plane/utils";
// components
import { IssueTypeDropdown } from "@/components/dropdowns/issue-type";
// hooks
import { usePreselectedIssueTypeId } from "@/hooks/use-preselected-issue-type";
// local imports
import { QuickAddIssueFormRoot } from "./form/root";
import { useCreateIssueToastActions } from "../../create-issue-toast-action-items";

export type TQuickAddIssueForm = {
  ref: React.RefObject<HTMLFormElement | null>;
  isOpen: boolean;
  projectDetail: IProject;
  hasError: boolean;
  register: UseFormRegister<TIssue>;
  onSubmit: () => void;
  typeSelect: React.ReactNode;
};

export type TQuickAddIssueButton = {
  onClick: () => void;
};

type TQuickAddIssueRoot = {
  isQuickAddOpen?: boolean;
  layout: EIssueLayoutTypes;
  prePopulatedData?: Partial<TIssue>;
  QuickAddButton?: FC<TQuickAddIssueButton>;
  customQuickAddButton?: React.ReactNode;
  containerClassName?: string;
  setIsQuickAddOpen?: (isOpen: boolean) => void;
  quickAddCallback?: (projectId: string | null | undefined, data: TIssue) => Promise<TIssue | undefined>;
};

const defaultValues: Partial<TIssue> = {
  name: "",
};

/** The type the user picked, else the group's, else the one last used in the project. */
const useQuickAddType = (workspaceSlug: string | undefined, projectId: string | undefined, groupTypeId?: string) => {
  const [chosenTypeId, setChosenTypeId] = useState<string>();
  const preselectedTypeId = usePreselectedIssueTypeId(workspaceSlug, projectId);
  return { typeId: chosenTypeId ?? groupTypeId ?? preselectedTypeId, setChosenTypeId };
};

export const QuickAddIssueRoot = observer(function QuickAddIssueRoot(props: TQuickAddIssueRoot) {
  const {
    isQuickAddOpen,
    layout,
    prePopulatedData,
    QuickAddButton,
    customQuickAddButton,
    containerClassName = "",
    setIsQuickAddOpen,
    quickAddCallback,
  } = props;
  // i18n
  const { t } = useTranslation();
  // router
  const { workspaceSlug, projectId } = useParams();
  // propel: toast actions cross the boundary as data, never as JSX
  const buildCreateIssueToastActions = useCreateIssueToastActions();
  // states
  const [isOpen, setIsOpen] = useState(isQuickAddOpen ?? false);
  const { typeId, setChosenTypeId } = useQuickAddType(
    workspaceSlug?.toString(),
    projectId?.toString(),
    prePopulatedData?.type_id
  );
  // form info
  const {
    reset,
    handleSubmit,
    setFocus,
    register,
    formState: { errors, isSubmitting },
  } = useForm<TIssue>({ defaultValues });

  useEffect(() => {
    if (isQuickAddOpen !== undefined) {
      setIsOpen(isQuickAddOpen);
    }
  }, [isQuickAddOpen]);

  useEffect(() => {
    if (!isOpen) reset({ ...defaultValues });
  }, [isOpen, reset]);

  // oxlint-disable-next-line no-shadow
  const handleIsOpen = (isOpen: boolean) => {
    if (isQuickAddOpen !== undefined && setIsQuickAddOpen) {
      setIsQuickAddOpen(isOpen);
    } else {
      setIsOpen(isOpen);
    }
  };

  const onSubmitHandler = async (formData: TIssue) => {
    if (isSubmitting || !workspaceSlug || !projectId) return;

    reset({ ...defaultValues });

    const payload = createIssuePayload(projectId.toString(), {
      // oxlint-disable-next-line unicorn/no-useless-fallback-in-spread
      ...(prePopulatedData ?? {}),
      ...formData,
      type_id: typeId,
    });

    if (quickAddCallback) {
      const quickAddPromise = quickAddCallback(projectId.toString(), { ...payload });
      setPromiseToast<any>(quickAddPromise, {
        loading: t("issue.adding"),
        success: {
          title: t("common.success"),
          message: () => t("issue.create.success"),
          actionItems: (data) =>
            buildCreateIssueToastActions({ workspaceSlug: workspaceSlug.toString(), issueId: data.id }),
        },
        error: {
          title: t("common.error.label"),
          message: (err) => err?.message || t("common.error.message"),
        },
      });

      await quickAddPromise;
    }
  };

  if (!projectId) return null;

  return (
    <div
      className={cn(
        containerClassName,
        errors && errors?.name && errors?.name?.message ? `border-danger-strong bg-danger-subtle` : ``
      )}
    >
      {isOpen ? (
        <QuickAddIssueFormRoot
          isOpen={isOpen}
          layout={layout}
          prePopulatedData={prePopulatedData}
          projectId={projectId?.toString()}
          // oxlint-disable-next-line no-unneeded-ternary
          hasError={errors && errors?.name && errors?.name?.message ? true : false}
          setFocus={setFocus}
          register={register}
          onSubmit={handleSubmit(onSubmitHandler)}
          onClose={() => {
            setChosenTypeId(undefined);
            handleIsOpen(false);
          }}
          typeSelect={
            <>
              <IssueTypeDropdown
                projectId={projectId.toString()}
                value={typeId}
                onChange={setChosenTypeId}
                variant="pill-sm"
                className="shrink-0"
              />
              {/* The picker adds a hidden field, so Enter needs a submit button to submit the form */}
              <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true" />
            </>
          }
        />
      ) : (
        <>
          {QuickAddButton && <QuickAddButton onClick={() => handleIsOpen(true)} />}
          {customQuickAddButton && <>{customQuickAddButton}</>}
          {!QuickAddButton && !customQuickAddButton && (
            <button
              className="flex w-full cursor-pointer items-center gap-2 bg-layer-transparent px-2 py-3 hover:bg-layer-transparent-hover"
              onClick={() => handleIsOpen(true)}
            >
              <AddOutline className="h-3.5 w-3.5" />
              <span className="text-13 font-medium">{t("issue.new")}</span>
            </button>
          )}
        </>
      )}
    </div>
  );
});
