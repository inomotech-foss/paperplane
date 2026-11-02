/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { stripHTML } from "@plane/utils";

export const extractTextFromHTML = (html: string): string => stripHTML(html);
