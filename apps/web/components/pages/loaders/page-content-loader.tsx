/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import { Loader } from "@plane/blocks/skeleton";
import { cn } from "@plane/utils";
import { EditorContentLoader } from "./editor-content-loader";

type Props = {
  className?: string;
};

export function PageContentLoader(props: Props) {
  const { className } = props;

  return (
    <div className={cn("relative flex size-full flex-col", className)}>
      {/* header */}
      <div className="relative flex h-12 w-full flex-shrink-0 items-center divide-x divide-subtle border-b border-subtle">
        <Loader className="relative flex items-center gap-1 pr-2">
          <Loader.Item width="26px" height="26px" />
          <Loader.Item width="26px" height="26px" />
          <Loader.Item width="26px" height="26px" />
          <Loader.Item width="26px" height="26px" />
          <Loader.Item width="26px" height="26px" />
          <Loader.Item width="26px" height="26px" />
          <Loader.Item width="26px" height="26px" />
        </Loader>
        <Loader className="relative flex items-center gap-1 px-2">
          <Loader.Item width="26px" height="26px" />
          <Loader.Item width="26px" height="26px" />
        </Loader>
        <Loader className="relative flex items-center gap-1 px-2">
          <Loader.Item width="26px" height="26px" />
          <Loader.Item width="26px" height="26px" />
        </Loader>
        <Loader className="relative flex items-center gap-1 pl-2">
          <Loader.Item width="26px" height="26px" />
          <Loader.Item width="26px" height="26px" />
        </Loader>
      </div>

      {/* content */}
      <div className="relative flex size-full overflow-hidden pt-[64px]">
        {/* editor loader */}
        <div className="size-full py-5">
          <EditorContentLoader />
        </div>
      </div>
    </div>
  );
}
