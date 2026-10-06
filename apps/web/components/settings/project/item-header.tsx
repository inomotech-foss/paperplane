/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { PROJECT_SETTINGS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Breadcrumbs } from "@plane/blocks/breadcrumb";
import type { TProjectSettingsTabs } from "@plane/types";
// components
import { BreadcrumbLink } from "@/components/common/breadcrumb-link";
import { SettingsPageHeader } from "@/components/settings/page-header";
// local imports
import { PROJECT_SETTINGS_ICONS } from "./sidebar/item-icon";

type Props = {
  settingKey: TProjectSettingsTabs;
};

export const ProjectSettingsItemHeader = observer(function ProjectSettingsItemHeader({ settingKey }: Props) {
  const { t } = useTranslation();
  const Icon = PROJECT_SETTINGS_ICONS[settingKey];

  return (
    <SettingsPageHeader
      leftItem={
        <Breadcrumbs>
          <Breadcrumbs.Item
            component={
              <BreadcrumbLink
                label={t(PROJECT_SETTINGS[settingKey].i18n_label)}
                icon={<Icon className="size-4 text-tertiary" />}
              />
            }
          />
        </Breadcrumbs>
      }
    />
  );
});
