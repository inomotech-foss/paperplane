/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { vi } from "vitest";

// jsdom ships no canvas, and the emoji support probe reaches for one at import time.
vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
