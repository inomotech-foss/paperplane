/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { IWorkspaceSearchResults } from "@plane/types";

type TSearchResultItem = IWorkspaceSearchResults["results"][keyof IWorkspaceSearchResults["results"]][number];

// cmdk filters items client-side by this value
export function getSearchItemValue(key: string, item: TSearchResultItem): string {
  let value = `${key}-${item.id}-${item.name}`;

  if ("identifier" in item) {
    value = `${value}-${item.identifier}`;
  }

  if ("project__identifier" in item) {
    value = `${value}-${item.project__identifier}`;
  }

  if ("project_identifiers" in item && item.project_identifiers?.length) {
    value = `${value}-${item.project_identifiers.join("-")}`;
  }

  if ("sequence_id" in item) {
    value = `${value}-${item.sequence_id}`;
  }

  return value;
}
