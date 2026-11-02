/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { Tab, TabsList } from "@makeplane/propel/components/tabs";
import { Tooltip } from "@makeplane/propel/components/tooltip";
import { useTranslation } from "@plane/i18n";
// plane web components
import { ORDERED_PAGE_NAVIGATION_TABS_LIST } from "@/components/pages/navigation-pane/tab-panels";
import type { TPageNavigationPaneTab } from "@/components/pages/navigation-pane/tab-panels";

type Props = {
  activeTab: TPageNavigationPaneTab;
};

/** Icon tabs that name only the active one, so the strip fits the pane in every language. */
export function PageNavigationPaneTabsList({ activeTab }: Props) {
  // translation
  const { t } = useTranslation();

  return (
    <div className="mx-3.5">
      <TabsList>
        {ORDERED_PAGE_NAVIGATION_TABS_LIST.map(({ key, i18n_label, icon: Icon }) => {
          const label = t(i18n_label);
          const isActive = key === activeTab;
          return (
            <Tooltip key={key} label={label} disabled={isActive}>
              <Tab
                value={key}
                label={isActive ? label : ""}
                aria-label={label}
                icon={<Icon aria-hidden className="size-3.5 shrink-0" />}
              />
            </Tooltip>
          );
        })}
      </TabsList>
    </div>
  );
}
