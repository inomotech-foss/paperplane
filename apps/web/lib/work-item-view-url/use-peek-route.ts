// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect, useLayoutEffect, useRef } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";
import type { Path } from "react-router";
import type { TPeekIssue } from "@/store/issue/issue-details/root.store";
import { formatPeekRef, parsePeekRef, readPeekParam, registerPeekRoute, withPeekParam } from "./peek";
import { normalizeSearch } from "./stringify";
import type { TPeekRef } from "./types";

/** What a route needs to show the peek from its URL. */
export type TPeekBinding = {
  /** The URL form of a peek, or undefined if it has none. */
  toRef: (peek: TPeekIssue) => TPeekRef | undefined;
  /** The peek a URL asks for, or undefined if the work item is not found. */
  resolve: (ref: TPeekRef) => Promise<TPeekIssue | undefined>;
  /** Shows the peek in the store. */
  show: (peek: TPeekIssue | undefined) => void;
};

/**
 * Makes the `peek` param the source of the shown peek: opening and closing it become replace navigations,
 * and the URL decides what the peek shows. Pass a stable binding.
 */
export const usePeekRoute = (binding: TPeekBinding) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { location: target } = useNavigation();
  /** The URL a change builds on, or undefined while a navigation leaves this page. */
  const latest = useRef<Path | undefined>(location);
  /** The last peek asked for, so the shown one keeps details the URL does not hold. */
  const requested = useRef<TPeekIssue | undefined>(undefined);
  /** Whether the shown peek came from the URL. */
  const shown = useRef(false);

  useLayoutEffect(() => {
    latest.current = target && target.pathname !== location.pathname ? undefined : (target ?? location);
  }, [target, location]);

  useLayoutEffect(
    () =>
      registerPeekRoute({
        onPeek: (peek) => {
          const ref = peek ? binding.toRef(peek) : undefined;
          if (!latest.current || (peek && !ref)) return false;
          requested.current = peek;
          const { pathname, search, hash } = latest.current;
          const next = `?${withPeekParam(search, ref)}`;
          if (normalizeSearch(next) === normalizeSearch(search)) {
            shown.current = !!peek;
            binding.show(peek);
            return true;
          }
          latest.current = { pathname, search: next, hash };
          Promise.resolve(
            navigate({ pathname, search: next, hash }, { replace: true, preventScrollReset: true })
          ).catch((error: unknown) => console.error(error));
          return true;
        },
      }),
    [binding, navigate]
  );

  const peekRef = readPeekParam(location.search);
  const peekKey = peekRef ? formatPeekRef(peekRef) : undefined;

  useEffect(() => {
    const ref = peekKey ? parsePeekRef(peekKey) : undefined;
    if (!ref) {
      if (shown.current) {
        shown.current = false;
        binding.show(undefined);
      }
      return;
    }
    let active = true;
    binding
      .resolve(ref)
      .then((peek) => {
        if (!active) return;
        const asked = requested.current;
        const next = peek && asked?.issueId === peek.issueId ? asked : peek;
        shown.current = !!next;
        binding.show(next);
      })
      .catch((error: unknown) => console.error(error));
    return () => {
      active = false;
    };
  }, [peekKey, binding]);

  // the peek belongs to this page
  useEffect(
    () => () => {
      if (!shown.current) return;
      shown.current = false;
      binding.show(undefined);
    },
    [binding]
  );
};
