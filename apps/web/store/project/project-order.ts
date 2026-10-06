// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { sortBy } from "lodash-es";

type TSortableProject = { sort_order: number | null; name: string };

export const sortProjectsBySortOrder = <T extends TSortableProject>(projects: T[]): T[] =>
  sortBy(projects, [(project) => project.sort_order, (project) => project.name.toLowerCase()]);
