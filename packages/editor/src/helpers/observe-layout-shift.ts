// SPDX-License-Identifier: AGPL-3.0-only

/**
 * Calls `onShift` when the width of `element` or one of its ancestors changes, for example when a side pane
 * opens and the centered editor moves. Height changes are ignored so typing does not trigger it.
 */
export const observeLayoutShift = (element: HTMLElement, onShift: () => void): (() => void) => {
  const widths = new WeakMap<Element, number>();
  const observer = new ResizeObserver((entries) => {
    let shifted = false;
    for (const entry of entries) {
      const width = entry.contentRect.width;
      const previous = widths.get(entry.target);
      widths.set(entry.target, width);
      if (previous !== undefined && previous !== width) shifted = true;
    }
    if (shifted) onShift();
  });
  for (let node: HTMLElement | null = element; node && node !== node.ownerDocument.body; node = node.parentElement) {
    observer.observe(node);
  }
  return () => observer.disconnect();
};
