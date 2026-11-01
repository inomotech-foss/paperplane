/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { clickableCardRaisedClassName } from "@plane/blocks/clickable-card";

// Any of these on an element starts a stacking context
const STACKING_CONTEXT = /(^|\s)(opacity-\d+|transform|filter|blur-\S+|isolate|z-\S+)(\s|$)/;

const RAISED_SELECTOR = clickableCardRaisedClassName
  .split(" ")
  .map((name) => `.${name.replace(/[[\]]/g, "\\$&")}`)
  .join("");

/**
 * Returns the class names of every element between a raised layer and its clickable card that
 * starts a stacking context. Such an element traps the raised layer below the card link.
 */
export function findStackingTraps(card: Element): string[] {
  return Array.from(card.querySelectorAll(RAISED_SELECTOR)).flatMap((raised) => {
    const traps: string[] = [];
    for (let node = raised.parentElement; node && node !== card; node = node.parentElement) {
      // A raised ancestor already lifts everything inside it
      if (node.matches(RAISED_SELECTOR)) return [];
      const className = node.getAttribute("class") ?? "";
      if (STACKING_CONTEXT.test(className)) traps.push(className);
    }
    return traps;
  });
}
