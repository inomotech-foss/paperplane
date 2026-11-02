/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { z } from "zod";
import { AppError } from "@/lib/errors";
import { APIService } from "@/services/api.service";

const pageAccessSchema = z.object({ access: z.enum(["edit", "read"]) });

export type TPageAccess = z.infer<typeof pageAccessSchema>["access"];

export type TPageAccessTarget = {
  cookie: string;
  workspaceSlug: string | null;
  projectId: string | null;
  pageId: string;
};

const slugSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/);

export class PageAccessService extends APIService {
  /** Throws for no access, a malformed target and any API or network failure. */
  async fetchAccess({ cookie, workspaceSlug, projectId, pageId }: TPageAccessTarget): Promise<TPageAccess> {
    const slug = slugSchema.safeParse(workspaceSlug);
    const project = z.uuid().safeParse(projectId);
    const page = z.uuid().safeParse(pageId);
    if (!slug.success || !project.success || !page.success) {
      throw new AppError("Invalid page access target", { code: "PAGE_ACCESS_INVALID_TARGET" });
    }
    const path = `/api/workspaces/${slug.data}/projects/${project.data}/pages/${page.data}/live-access/`;
    const body = await this.requestJson("GET", path, { headers: { Cookie: cookie } });
    return pageAccessSchema.parse(body).access;
  }
}
