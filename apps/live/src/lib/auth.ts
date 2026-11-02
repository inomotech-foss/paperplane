/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { IncomingHttpHeaders } from "http";
import type { ConnectionConfiguration } from "@hocuspocus/server";
import { z } from "zod";
import { logger } from "@plane/logger";
import { AppError } from "@/lib/errors";
// services
import { PageAccessService, type TPageAccessTarget } from "@/services/page-access.service";
import { UserService } from "@/services/user.service";
// types
import type { HocusPocusServerContext, TDocumentTypes } from "@/types";

const tokenSchema = z.looseObject({
  id: z.string().optional(),
  cookie: z.string().optional(),
});

const isDocumentType = (value: string | null): value is TDocumentTypes => value === "project_page";

/**
 * Authenticate the user
 * @param requestHeaders - The request headers
 * @param context - The context
 * @param token - The token
 * @returns The authenticated user
 */
export const onAuthenticate = async ({
  requestHeaders,
  requestParameters,
  context,
  token,
  documentName,
  connectionConfig,
}: {
  requestHeaders: IncomingHttpHeaders;
  context: HocusPocusServerContext;
  requestParameters: URLSearchParams;
  token: string;
  documentName: string;
  connectionConfig: ConnectionConfiguration;
}) => {
  let cookie: string | undefined = undefined;
  let userId: string | undefined = undefined;

  // Extract cookie (fallback to request headers) and userId from token (for scenarios where
  // the cookies are not passed in the request headers)
  try {
    const parsedToken = tokenSchema.parse(JSON.parse(token));
    userId = parsedToken.id;
    cookie = parsedToken.cookie;
  } catch (error) {
    const appError = new AppError(error, {
      context: { operation: "onAuthenticate" },
    });
    logger.error("Token parsing failed, using request headers", appError);
  } finally {
    // If cookie is still not found, fallback to request headers
    if (!cookie) {
      cookie = requestHeaders.cookie?.toString();
    }
  }

  if (!cookie || !userId) {
    const appError = new AppError("Credentials not provided", { code: "AUTH_MISSING_CREDENTIALS" });
    logger.error("Credentials not provided", appError);
    throw appError;
  }

  // set cookie in context, so it can be used throughout the ws connection
  context.cookie = cookie ?? requestParameters.get("cookie") ?? "";
  const documentType = requestParameters.get("documentType");
  if (!isDocumentType(documentType)) {
    throw new AppError(`Invalid document type ${documentType} provided.`);
  }
  context.documentType = documentType;
  context.projectId = requestParameters.get("projectId");
  context.userId = userId;
  context.workspaceSlug = requestParameters.get("workspaceSlug");

  const authentication = await handleAuthentication({
    cookie: context.cookie,
    userId: context.userId,
  });

  // Hocuspocus shares a loaded document with every connection to the same name, so each one needs its own check.
  const access = await checkPageAccess({
    cookie: context.cookie,
    workspaceSlug: context.workspaceSlug,
    projectId: context.projectId,
    pageId: documentName,
  });
  connectionConfig.readOnly = access === "read";

  return authentication;
};

const checkPageAccess = async (target: TPageAccessTarget) => {
  try {
    return await new PageAccessService().fetchAccess(target);
  } catch (error) {
    const appError = new AppError(error, {
      context: { operation: "checkPageAccess" },
    });
    logger.error("Page access check failed", appError);
    throw new AppError("Page access denied", { code: appError.code, statusCode: appError.statusCode });
  }
};

export const handleAuthentication = async ({ cookie, userId }: { cookie: string; userId: string }) => {
  // fetch current user info
  try {
    const userService = new UserService();
    const user = await userService.currentUser(cookie);
    if (user.id !== userId) {
      throw new AppError("Authentication unsuccessful: User ID mismatch", { code: "AUTH_USER_MISMATCH" });
    }

    return {
      user: {
        id: user.id,
        name: user.display_name,
      },
    };
  } catch (error) {
    const appError = new AppError(error, {
      context: { operation: "handleAuthentication" },
    });
    logger.error("Authentication failed", appError);
    throw new AppError("Authentication unsuccessful", { code: appError.code });
  }
};
