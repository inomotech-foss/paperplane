/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { applyTransform as applyHypermodTransform } from "@hypermod/utils";

// Extra keys reach the transform as its options.
type TTransformOptions = Parameters<typeof applyHypermodTransform>[2] &
  Record<string, string>;

export const applyTransform = async (
  transform: object,
  input: string,
  options?: TTransformOptions
): Promise<string> => {
  const result: unknown = await applyHypermodTransform(
    transform,
    input,
    options
  );
  if (typeof result !== "string")
    throw new Error("Transform did not return source text");
  return result;
};
