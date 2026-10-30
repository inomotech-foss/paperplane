/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

const asHTMLElement = (node: Node | null | undefined) => (node instanceof HTMLElement ? node : null);

export const useTableKeyboardNavigation = () => {
  const getPreviousRow = (element: HTMLElement) => {
    const previousRow = element.closest("tr")?.previousSibling;

    if (previousRow) return previousRow;
    //if previous row does not exist in the parent check the row with the header of the table
    return element.closest("tbody")?.previousSibling?.childNodes?.[0];
  };

  const getNextRow = (element: HTMLElement) => {
    const nextRow = element.closest("tr")?.nextSibling;

    if (nextRow) return nextRow;
    //if next row does not exist in the parent check the row with the body of the table
    return element.closest("thead")?.nextSibling?.childNodes?.[0];
  };

  const handleKeyBoardNavigation = function (e: React.KeyboardEvent<HTMLTableElement>) {
    const element = e.target;

    if (!(element instanceof HTMLElement) || !(element.tagName === "TD" || element.tagName === "TH")) return;

    let c: HTMLElement | null = null;
    if (e.key == "ArrowRight") {
      // Right Arrow
      c = asHTMLElement(element.nextSibling);
    } else if (e.key == "ArrowLeft") {
      // Left Arrow
      c = asHTMLElement(element.previousSibling);
    } else if (e.key == "ArrowUp") {
      // Up Arrow
      const index = Array.prototype.indexOf.call(element?.parentNode?.childNodes || [], element);
      const prevRow = getPreviousRow(element);

      c = asHTMLElement(prevRow?.childNodes?.[index]);
    } else if (e.key == "ArrowDown") {
      // Down Arrow
      const index = Array.prototype.indexOf.call(element?.parentNode?.childNodes || [], element);
      const nextRow = getNextRow(element);

      c = asHTMLElement(nextRow?.childNodes[index]);
    } else if (e.key == "Enter" || e.key == "Space") {
      e.preventDefault();
      element.querySelector<HTMLElement>(".clickable")?.click();
      return;
    }

    if (!c) return;

    e.preventDefault();
    c?.focus();
    c?.scrollIntoView({ behavior: "smooth", block: "center", inline: "end" });
  };

  return handleKeyBoardNavigation;
};
