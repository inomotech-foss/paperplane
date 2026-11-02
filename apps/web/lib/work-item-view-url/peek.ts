// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TPeekIssue } from "@/store/issue/issue-details/root.store";
import { peekCodec } from "./codecs";
import { VIEW_PARAM_NAMES } from "./schema";
import { stringifySearch } from "./stringify";
import type { TPeekRef } from "./types";

const PEEK_PARAM = "peek";

/** A mounted route that shows the peek from the URL. The issue detail store hands peek changes to it. */
export type TPeekRoute = {
  /** False if the route cannot show this peek, so the store shows it in place. */
  onPeek: (peek: TPeekIssue | undefined) => boolean;
};

// a stack: while two mounts overlap, the later one is active
let routes: TPeekRoute[] = [];

/** Returns the cleanup, which removes only this registration. */
export const registerPeekRoute = (route: TPeekRoute): (() => void) => {
  routes = [...routes, route];
  return () => {
    routes = routes.filter((entry) => entry !== route);
  };
};

export const getPeekRoute = (): TPeekRoute | undefined => routes.at(-1);

export const parsePeekRef = (raw: string): TPeekRef | undefined => peekCodec.parse(raw)?.value;

export const readPeekParam = (search: string): TPeekRef | undefined => {
  const raw = new URLSearchParams(search).get(PEEK_PARAM);
  return raw ? parsePeekRef(raw) : undefined;
};

/** The search with the peek set or removed. The peek goes after the view params, as in a canonical URL. */
export const withPeekParam = (search: string, peek: TPeekRef | undefined): string => {
  const entries = [...new URLSearchParams(search)].filter(([key]) => key !== PEEK_PARAM);
  if (peek) {
    const afterViewParams = entries.reduce((index, [key], i) => (VIEW_PARAM_NAMES.has(key) ? i + 1 : index), 0);
    entries.splice(afterViewParams, 0, [PEEK_PARAM, peekCodec.format(peek)]);
  }
  return stringifySearch(new URLSearchParams(entries));
};

export const formatPeekRef = (peek: TPeekRef): string => peekCodec.format(peek);
