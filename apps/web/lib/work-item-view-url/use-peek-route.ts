// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";
import { useLocation, useNavigate, useNavigation } from "react-router";
import type { NavigateFunction, Path } from "react-router";
import type { TPeekIssue } from "@/store/issue/issue-details/root.store";
import { formatPeekRef, parsePeekRef, readPeekParam, registerPeekRoute, withPeekParam } from "./peek";
import type { TPeekBinding } from "./peek";
import { normalizeSearch } from "./stringify";
import type { TPeekRef } from "./types";

export type { TPeekBinding } from "./peek";

type TPeekState = {
  /** The URL a change builds on, or undefined while a navigation leaves this page. */
  latest: Path | undefined;
  /** The last peek asked for, so the shown one keeps details the URL does not hold. */
  requested: TPeekIssue | undefined;
  /** Whether the shown peek came from the URL. */
  shown: boolean;
  /** The lookup of the peek in the URL, shared by effect reruns for the same URL. */
  lookup?: { key: string; result: Promise<TPeekIssue | undefined> };
};

/** Replaces the peek param of the latest URL. False if the URL stays as it is. */
const writePeek = (state: RefObject<TPeekState>, navigate: NavigateFunction, ref: TPeekRef | undefined): boolean => {
  const { latest } = state.current;
  if (!latest) return false;
  const { pathname, search, hash } = latest;
  const next = `?${withPeekParam(search, ref)}`;
  if (normalizeSearch(next) === normalizeSearch(search)) return false;
  // set before React renders the navigation, so a change right after builds on this one
  state.current.latest = { pathname, search: next, hash };
  Promise.resolve(navigate({ pathname, search: next, hash }, { replace: true, preventScrollReset: true })).catch(
    (error: unknown) => console.error(error)
  );
  return true;
};

const showPeek = (state: RefObject<TPeekState>, binding: TPeekBinding, peek: TPeekIssue | undefined) => {
  const asked = state.current.requested;
  const next = peek && asked?.issueId === peek.issueId ? asked : peek;
  state.current.shown = !!next;
  binding.show(next);
};

/**
 * Makes the `peek` param the source of the shown peek: opening and closing it become replace navigations,
 * and the URL decides what the peek shows. Pass a stable binding.
 */
export const usePeekRoute = (binding: TPeekBinding) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { location: target } = useNavigation();
  const state = useRef<TPeekState>({ latest: location, requested: undefined, shown: false });

  useLayoutEffect(() => {
    state.current.latest = target && target.pathname !== location.pathname ? undefined : (target ?? location);
  }, [target, location]);

  useLayoutEffect(
    () =>
      registerPeekRoute({
        onPeek: (peek) => {
          const { latest } = state.current;
          if (!latest) return false;
          const ref = peek ? binding.toRef(peek) : undefined;
          state.current.requested = peek;
          if (peek && !ref) {
            // shown in place, so the URL must stop naming another work item
            state.current.shown = false;
            writePeek(state, navigate, undefined);
            return false;
          }
          // an unchanged URL brings no navigation to show it
          if (!writePeek(state, navigate, ref)) showPeek(state, binding, peek);
          return true;
        },
      }),
    [binding, navigate]
  );

  const peekRef = readPeekParam(location.search);
  const peekKey = peekRef ? formatPeekRef(peekRef) : undefined;

  useEffect(() => {
    const ref = peekKey ? parsePeekRef(peekKey) : undefined;
    if (!peekKey || !ref) {
      state.current.lookup = undefined;
      if (state.current.shown) showPeek(state, binding, undefined);
      return;
    }
    const found = binding.find(ref);
    if (found) {
      state.current.lookup = undefined;
      showPeek(state, binding, found);
      return;
    }
    let active = true;
    const lookup =
      state.current.lookup?.key === peekKey ? state.current.lookup : { key: peekKey, result: binding.lookup(ref) };
    state.current.lookup = lookup;
    lookup.result
      .then((peek) => {
        if (!active) return;
        if (peek) {
          showPeek(state, binding, peek);
          return;
        }
        binding.notFound();
        if (state.current.shown) showPeek(state, binding, undefined);
        writePeek(state, navigate, undefined);
      })
      .catch((error: unknown) => console.error(error));
    return () => {
      active = false;
    };
  }, [peekKey, binding, navigate]);

  // the peek belongs to this page
  useEffect(
    () => () => {
      if (!state.current.shown) return;
      state.current.shown = false;
      binding.show(undefined);
    },
    [binding]
  );
};
