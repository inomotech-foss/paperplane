/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TAllAvailableOperatorsForDisplay, TNegatedOperators, TSupportedOperators } from "@plane/types";
import { COLLECTION_OPERATOR, EQUALITY_OPERATOR, NEGATED_OPERATORS } from "@plane/types";

/**
 * Result type for operator conversion
 */
export type TOperatorForPayload = {
  operator: TSupportedOperators;
  isNegation: boolean;
};

// positive operator -> the display operator of the same condition inside a NOT group
const NEGATED_BY_OPERATOR: Partial<Record<TSupportedOperators, TNegatedOperators>> = {
  [EQUALITY_OPERATOR.EXACT]: NEGATED_OPERATORS.NOT_EXACT,
  [COLLECTION_OPERATOR.IN]: NEGATED_OPERATORS.NOT_IN,
  [EQUALITY_OPERATOR.ICONTAINS]: NEGATED_OPERATORS.NOT_ICONTAINS,
};

const OPERATOR_BY_NEGATED = Object.fromEntries(
  Object.entries(NEGATED_BY_OPERATOR).map(([operator, negated]) => [negated, operator])
) as Record<TNegatedOperators, TSupportedOperators>;

/** The negated display operator of an operator, when it has one ("is" -> "is not"). */
export const getNegatedOperator = (operator: TSupportedOperators): TNegatedOperators | undefined =>
  NEGATED_BY_OPERATOR[operator];

export const isNegatedOperator = (operator: TAllAvailableOperatorsForDisplay): operator is TNegatedOperators =>
  operator in OPERATOR_BY_NEGATED;

/**
 * Split a display operator into what a payload carries: the positive operator, and
 * whether the condition sits in a NOT group.
 */
export const getOperatorForPayload = (displayOperator: TAllAvailableOperatorsForDisplay): TOperatorForPayload =>
  isNegatedOperator(displayOperator)
    ? { operator: OPERATOR_BY_NEGATED[displayOperator], isNegation: true }
    : { operator: displayOperator, isNegation: false };
