/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { clickableCardRaisedClassName } from "@plane/blocks/clickable-card";

// Tailwind classes, with or without variants, that start a stacking context
const STACKING_CONTEXT =
  /^(?:[^\s:]+:)*-?(?:opacity-\d+|transform\S*|filter|blur\S*|drop-shadow\S*|backdrop-\S+|isolate|z-(?!auto)\S+|scale-\S+|rotate-\S+|translate-\S+|mix-blend-\S+|will-change-\S+|sticky|fixed)$/;

// Tailwind classes, with or without variants, that make an element positioned
const POSITIONED = /^(?:[^\s:]+:)*(?:relative|absolute|fixed|sticky)$/;

const toSelector = (classNames: string) =>
  classNames
    .split(" ")
    .map((name) => `.${name.replace(/[[\]:]/g, "\\$&")}`)
    .join("");

const RAISED_SELECTOR = toSelector(clickableCardRaisedClassName);
const LINK_SELECTOR = toSelector("after:absolute");

const matchingClasses = (node: Element, pattern: RegExp) =>
  (node.getAttribute("class") ?? "").split(/\s+/).filter((name) => pattern.test(name));

/**
 * Returns the classes of every element between a raised layer and its clickable card that starts
 * a stacking context. Such an element traps the raised layer below the card link.
 */
export function findStackingTraps(card: Element): string[] {
  return Array.from(card.querySelectorAll(RAISED_SELECTOR)).flatMap((raised) => {
    const traps: string[] = [];
    for (let node = raised.parentElement; node && node !== card; node = node.parentElement) {
      // A raised ancestor already lifts everything inside it
      if (node.matches(RAISED_SELECTOR)) return [];
      traps.push(...matchingClasses(node, STACKING_CONTEXT));
    }
    return traps;
  });
}

/**
 * Returns the classes of every positioned element between a card link and its clickable card.
 * Such an element shrinks the link to its own box instead of the whole card.
 */
export function findLinkOffsetParents(card: Element): string[] {
  return Array.from(card.querySelectorAll(LINK_SELECTOR)).flatMap((link) => {
    const parents: string[] = [];
    for (let node = link.parentElement; node && node !== card; node = node.parentElement) {
      parents.push(...matchingClasses(node, POSITIONED));
    }
    return parents;
  });
}
