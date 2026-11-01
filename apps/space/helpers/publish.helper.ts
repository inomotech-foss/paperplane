/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { z } from "zod";
import type { TLogoProps, TProjectDetails, TProjectPublishSettings, TProjectPublishViewProps } from "@plane/types";
import { isRecord } from "@plane/types";
import type { TPublishSettingsResponse } from "@/services/project.service";

const logoPropsSchema = z.object({
  in_use: z.enum(["emoji", "icon"]),
  emoji: z.object({ value: z.string().optional(), url: z.string().optional() }).optional(),
  icon: z
    .object({ name: z.string().optional(), color: z.string().optional(), background_color: z.string().optional() })
    .optional(),
});

const EMPTY_LOGO: TLogoProps = { in_use: "emoji" };

const VIEW_PROP_KEYS = ["calendar", "gantt", "kanban", "list", "spreadsheet"] as const;

/** Reads each layout flag on its own. A flag that is not a boolean is left out. */
export const parseViewProps = (value: unknown): TProjectPublishViewProps | undefined => {
  if (!isRecord(value)) return undefined;
  const viewProps: TProjectPublishViewProps = {};
  for (const key of VIEW_PROP_KEYS) {
    const flag = value[key];
    if (typeof flag === "boolean") viewProps[key] = flag;
  }
  return viewProps;
};

/** Parses the stored logo. An invalid logo renders as no logo. */
export const parseLogoProps = (value: unknown): TLogoProps => {
  const result = logoPropsSchema.safeParse(value);
  return result.success ? result.data : EMPTY_LOGO;
};

const toProjectDetails = (project: NonNullable<TPublishSettingsResponse["project_details"]>): TProjectDetails => ({
  id: project.id,
  name: project.name,
  identifier: project.identifier,
  description: project.description,
  cover_image: project.cover_image ?? undefined,
  logo_props: parseLogoProps(project.logo_props),
});

/** Maps the publish settings response to the store shape. */
export const toPublishSettings = (response: TPublishSettingsResponse): TProjectPublishSettings => ({
  id: response.id,
  anchor: response.anchor,
  created_at: response.created_at,
  created_by: response.created_by ?? undefined,
  updated_at: response.updated_at,
  updated_by: response.updated_by ?? undefined,
  entity_identifier: response.entity_identifier ?? undefined,
  entity_name: response.entity_name === "project" || response.entity_name === "page" ? response.entity_name : undefined,
  inbox: undefined,
  intake: response.intake,
  intake_issue_type: response.intake_issue_type,
  is_comments_enabled: response.is_comments_enabled,
  is_reactions_enabled: response.is_reactions_enabled,
  is_votes_enabled: response.is_votes_enabled,
  project: response.project ?? undefined,
  project_details: response.project_details ? toProjectDetails(response.project_details) : undefined,
  view_props: parseViewProps(response.view_props),
  workspace: response.workspace,
  workspace_detail: response.workspace_detail,
});
