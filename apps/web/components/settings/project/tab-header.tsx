// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { observer } from "mobx-react";
import { PROJECT_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import type { TProjectSettingsTabs } from "@plane/types";
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsPageHeader } from "@/components/settings/page-header";
import { PROJECT_SETTINGS_ICONS } from "@/components/settings/project/sidebar/item-icon";

export const ProjectSettingsTabHeader = observer(function ProjectSettingsTabHeader(props: {
  tab: TProjectSettingsTabs;
}) {
  const { t } = useTranslation();
  const TabIcon = PROJECT_SETTINGS_ICONS[props.tab];
  const breadcrumb = (
    <BreadcrumbLink
      label={t(PROJECT_SETTINGS[props.tab].i18n_label)}
      icon={<TabIcon className="size-4 text-tertiary" />}
    />
  );

  return (
    <SettingsPageHeader
      leftItem={
        <Breadcrumbs>
          <Breadcrumbs.Item component={breadcrumb} />
        </Breadcrumbs>
      }
    />
  );
});
