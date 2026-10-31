/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Command } from "cmdk";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { IWorkspaceSearchResults } from "@plane/types";
import type { TPowerKSearchResultsKeys } from "@/components/power-k/core/types";
// hooks
import { useAppRouter } from "@/hooks/use-app-router";
// helpers
import { PowerKModalCommandItem } from "./command-item";
import { getSearchItemValue } from "./search-item-value";
import type { TPowerKSearchResultItem } from "./search-results-map";
import { POWER_K_SEARCH_RESULTS_GROUPS_MAP, POWER_K_SEARCH_RESULTS_KEYS } from "./search-results-map";
import { isOneOf } from "@/helpers/narrow.helper";

type Props = {
  closePalette: () => void;
  results: IWorkspaceSearchResults;
};

type TSectionProps<K extends TPowerKSearchResultsKeys> = {
  sectionKey: K;
  section: TPowerKSearchResultItem<K>[];
  projectId: string | undefined;
  onSelect: (path: string) => void;
};

function SearchResultsSection<K extends TPowerKSearchResultsKeys>(props: TSectionProps<K>) {
  const { sectionKey, section, projectId, onSelect } = props;
  const currentSection = POWER_K_SEARCH_RESULTS_GROUPS_MAP[sectionKey];

  if (section.length <= 0) return null;

  return (
    <Command.Group heading={currentSection.title}>
      {section.map((item) => (
        <PowerKModalCommandItem
          key={item.id}
          label={currentSection.itemName(item)}
          icon={currentSection.icon}
          onSelect={() => onSelect(currentSection.path(item, projectId))}
          value={getSearchItemValue(sectionKey, item)}
        />
      ))}
    </Command.Group>
  );
}

export const PowerKModalSearchResults = observer(function PowerKModalSearchResults(props: Props) {
  const { closePalette, results } = props;
  // router
  const router = useAppRouter();
  const { projectId: routerProjectId } = useParams();
  // derived values
  const projectId = routerProjectId?.toString();

  return (
    <>
      {Object.keys(results.results)
        .filter((key): key is TPowerKSearchResultsKeys => isOneOf(POWER_K_SEARCH_RESULTS_KEYS, key))
        .map((key) => (
          <SearchResultsSection
            key={key}
            sectionKey={key}
            section={results.results[key]}
            projectId={projectId}
            onSelect={(path) => {
              closePalette();
              router.push(path);
            }}
          />
        ))}
    </>
  );
});
