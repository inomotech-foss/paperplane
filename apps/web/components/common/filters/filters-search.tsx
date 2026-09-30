/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { CloseOutline, SearchOutline } from "@makeplane/propel/icons";
// hooks
import { usePlatformOS } from "@/hooks/use-platform-os";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export function FiltersSearchHeader(props: Props) {
  const { value, onChange } = props;
  const { isMobile } = usePlatformOS();

  return (
    <div className="bg-surface-1 p-2.5 pb-0">
      <label className="flex items-center gap-1.5 rounded-sm border-[0.5px] border-subtle bg-surface-2 px-1.5 py-1 text-11">
        <SearchOutline className="text-placeholder" width={12} height={12} />
        <span className="sr-only">Search</span>
        <input
          type="text"
          className="w-full bg-surface-2 outline-none placeholder:text-placeholder"
          placeholder="Search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // oxlint-disable-next-line jsx_a11y/no-autofocus
          autoFocus={!isMobile}
        />
        {value !== "" && (
          <button
            type="button"
            aria-label="Clear search"
            className="grid place-items-center"
            onClick={() => onChange("")}
          >
            <CloseOutline className="text-tertiary" height={12} width={12} />
          </button>
        )}
      </label>
    </div>
  );
}
