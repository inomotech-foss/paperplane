/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

const INTERACTIVE = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "[role='button']",
  "[role='link']",
  "[role='checkbox']",
  "[role='switch']",
  "[role='combobox']",
  "[role='menuitem']",
];

export const NESTED_INTERACTIVE_SELECTOR = INTERACTIVE.flatMap((outer) =>
  INTERACTIVE.map((inner) => `${outer} ${inner}`)
).join(", ");

/** Returns the markup of every interactive element nested in another one, so a failure shows the culprit. */
export function findNestedInteractive(container: ParentNode): string[] {
  return Array.from(container.querySelectorAll(NESTED_INTERACTIVE_SELECTOR), (element) => element.outerHTML);
}
