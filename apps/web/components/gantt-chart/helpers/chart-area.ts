/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

const getChartArea = (container: HTMLElement) => container.querySelector<HTMLElement>("[data-gantt-chart-area]");

/** Where the chart area starts in the scroll content, which is where the sidebar ends. */
export const getChartOffset = (container: HTMLElement) => {
  const chartArea = getChartArea(container);
  if (!chartArea) return 0;
  return chartArea.getBoundingClientRect().left - container.getBoundingClientRect().left + container.scrollLeft;
};
