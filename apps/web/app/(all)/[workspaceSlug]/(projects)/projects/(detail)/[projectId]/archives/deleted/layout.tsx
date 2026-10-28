/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Outlet } from "react-router";
// components
import { AppHeader } from "@/components/core/app-header";
import { ContentWrapper } from "@/components/core/content-wrapper";
import { ProjectArchivesHeader } from "../header";

export default function ProjectArchiveDeletedLayout() {
  return (
    <>
      <AppHeader header={<ProjectArchivesHeader activeTab="deleted" />} />
      <ContentWrapper>
        <Outlet />
      </ContentWrapper>
    </>
  );
}
