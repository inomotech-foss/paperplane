// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { cn } from "@plane/utils";

// Shared by the lazy editor and its fallback; kept apart so the fallback does not load CodeMirror.
export const editorBoxClass = (hasError: boolean, className?: string) =>
  cn(
    "font-mono flex h-7 w-full min-w-0 flex-1 items-center truncate rounded-sm border bg-layer-1 px-2 text-12 text-primary focus-within:border-accent-strong",
    hasError ? "border-danger-strong" : "border-subtle-1",
    className
  );
