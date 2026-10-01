/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
// plane imports
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { InstanceUserService } from "@plane/services";
import type { IInstanceUser } from "@plane/types";

const instanceUserService = new InstanceUserService();

type Props = {
  /** Users that must not be offered, such as the row being acted on. */
  excludeIds?: string[];
  selected?: IInstanceUser;
  onSelect: (user: IInstanceUser) => void;
  inputId: string;
};

/** A search box over all active, non-bot users on the instance. */
export function UserPicker(props: Props) {
  const { excludeIds = [], selected, onSelect, inputId } = props;
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<IInstanceUser[]>([]);

  useEffect(() => {
    if (selected) return;
    const handle = setTimeout(() => {
      instanceUserService
        .list({ search: query, is_active: true, is_bot: false })
        .then((page) => setResults(page.results))
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, selected]);

  const candidates = results.filter((user) => !excludeIds.includes(user.id));

  if (selected) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-subtle px-3 py-2 text-13">
        <span className="truncate">
          <span className="font-medium">{selected.display_name}</span>{" "}
          <span className="text-tertiary">{selected.email}</span>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <InputGroup size="lg">
        <Input
          size="lg"
          id={inputId}
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by email or name"
          autoComplete="off"
        />
      </InputGroup>
      <ul className="max-h-48 divide-y divide-subtle overflow-y-auto rounded-md border border-subtle">
        {candidates.length === 0 && <li className="px-3 py-2 text-11 text-tertiary">No matching users.</li>}
        {candidates.map((user) => (
          <li key={user.id}>
            <button
              type="button"
              onClick={() => onSelect(user)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-13 hover:bg-layer-1-hover"
            >
              <span className="truncate font-medium">{user.display_name}</span>
              <span className="truncate text-tertiary">{user.email}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
