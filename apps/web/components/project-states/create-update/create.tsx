/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { STATE_GROUPS } from "@plane/constants";
import { setToast } from "@plane/blocks/toast";
import type { IState, TStateGroups, TStateOperationsCallbacks } from "@plane/types";
// components
import { StateForm } from "@/components/project-states";
import { isStateNameTaken, serverErrorMessage } from "./errors";

type TStateCreate = {
  groupKey: TStateGroups;
  createStateCallback: TStateOperationsCallbacks["createState"];
  handleClose: () => void;
};

export const StateCreate = observer(function StateCreate(props: TStateCreate) {
  const { groupKey, createStateCallback, handleClose } = props;

  // states
  const [loader, setLoader] = useState(false);

  const onCancel = () => {
    setLoader(false);
    handleClose();
  };

  const onSubmit = async (formData: Partial<IState>) => {
    if (!groupKey) return { status: "error" };

    try {
      await createStateCallback({
        name: formData.name ?? "",
        color: formData.color ?? "",
        description: formData.description ?? "",
        group: groupKey,
      });

      setToast({
        type: "success",
        title: "Success!",
        message: "State created successfully.",
      });
      handleClose();
      return { status: "success" };
    } catch (error) {
      if (isStateNameTaken(error)) {
        setToast({
          type: "error",
          title: "Error!",
          message: "State with that name already exists. Please try again with another name.",
        });
        return { status: "already_exists" };
      } else {
        setToast({
          type: "error",
          title: "Error!",
          message: serverErrorMessage(error) ?? "State could not be created. Please try again.",
        });
        return { status: "error" };
      }
    }
  };

  return (
    <StateForm
      data={{ name: "", description: "", color: STATE_GROUPS[groupKey].color }}
      onSubmit={onSubmit}
      onCancel={onCancel}
      buttonDisabled={loader}
      buttonTitle={loader ? `Creating` : `Create`}
    />
  );
});
