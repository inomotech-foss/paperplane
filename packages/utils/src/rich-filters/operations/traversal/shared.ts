/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type {
  TAllAvailableOperatorsForDisplay,
  TFilterExpression,
  TFilterProperty,
  TSupportedOperators,
} from "@plane/types";
// local imports
import { getNegatedOperator } from "../../operators/shared";
import { isGroupNode, isNotGroupNode } from "../../types/core";
import { getGroupChildren } from "../../types/shared";

/**
 * Helper function to get the display operator for a condition.
 * This checks for NOT group context and applies negation if needed.
 * @param operator - The original operator
 * @param expression - The filter expression
 * @param conditionId - The ID of the condition
 * @returns The display operator (possibly negated)
 */
/** Whether the condition with `conditionId` is the child of a NOT group. */
const isInNotGroup = <P extends TFilterProperty>(expression: TFilterExpression<P>, conditionId: string): boolean => {
  if (!isGroupNode(expression)) return false;
  const children = getGroupChildren(expression);
  if (isNotGroupNode(expression) && children.some((child) => child.id === conditionId)) return true;
  return children.some((child) => isInNotGroup(child, conditionId));
};

/**
 * The operator a condition shows: its own, or the negated one ("is not") when the
 * condition sits in a NOT group.
 */
export const getDisplayOperator = <P extends TFilterProperty>(
  operator: TSupportedOperators,
  expression: TFilterExpression<P>,
  conditionId: string
): TAllAvailableOperatorsForDisplay =>
  (isInNotGroup(expression, conditionId) ? getNegatedOperator(operator) : undefined) ?? operator;
