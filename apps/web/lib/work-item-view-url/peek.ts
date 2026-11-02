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

export const formatPeekRef = (peek: TPeekRef): string => peekCodec.format(peek);

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

/** What a route needs to show the peek from its URL. */
export type TPeekBinding = {
  /** The URL form of a peek, or undefined if it has none. */
  toRef: (peek: TPeekIssue) => TPeekRef | undefined;
  /** The peek of a loaded work item, without a request. */
  find: (ref: TPeekRef) => TPeekIssue | undefined;
  /** The peek of a work item that is not loaded, or undefined if it is not found. */
  lookup: (ref: TPeekRef) => Promise<TPeekIssue | undefined>;
  /** Shows the peek in the store. */
  show: (peek: TPeekIssue | undefined) => void;
  /** Tells the person that the URL names no work item they can see. */
  notFound: () => void;
};

export type TPeekableIssue = { id: string; project_id: string | null; sequence_id: number };

/** The loaded work item a ref names. */
export const findIssueIdByRef = (
  issues: Iterable<TPeekableIssue>,
  getProjectIdentifier: (projectId: string) => string | undefined,
  { projectIdentifier, sequenceId }: TPeekRef
): string | undefined => {
  for (const issue of issues) {
    if (issue.sequence_id !== sequenceId || !issue.project_id) continue;
    if (getProjectIdentifier(issue.project_id)?.toUpperCase() === projectIdentifier) return issue.id;
  }
  return undefined;
};

/** What the peek binding reads from the store and the API. */
export type TPeekSources = {
  getIssue: (issueId: string) => TPeekableIssue | undefined;
  /** Finds a loaded work item without a request. */
  findIssueId: (ref: TPeekRef) => string | undefined;
  getProjectIdentifier: (projectId: string) => string | undefined;
  /** Looks up a work item that is not loaded. Only its id and project are used: the peek loads the rest. */
  lookupIssue: (ref: TPeekRef) => Promise<TPeekableIssue | undefined>;
  show: (peek: TPeekIssue | undefined) => void;
  notFound: () => void;
};

export const createPeekBinding = (workspaceSlug: string, sources: TPeekSources): TPeekBinding => {
  const toPeek = (issue: TPeekableIssue | undefined): TPeekIssue | undefined =>
    issue?.project_id ? { workspaceSlug, projectId: issue.project_id, issueId: issue.id } : undefined;
  return {
    toRef: (peek) => {
      if (peek.isArchived) return undefined;
      const sequenceId = sources.getIssue(peek.issueId)?.sequence_id;
      const projectIdentifier = sources.getProjectIdentifier(peek.projectId);
      return sequenceId && projectIdentifier
        ? { projectIdentifier: projectIdentifier.toUpperCase(), sequenceId }
        : undefined;
    },
    find: (ref) => {
      const issueId = sources.findIssueId(ref);
      return issueId ? toPeek(sources.getIssue(issueId)) : undefined;
    },
    lookup: async (ref) => {
      try {
        return toPeek(await sources.lookupIssue(ref));
      } catch (error) {
        console.error(error);
        return undefined;
      }
    },
    show: sources.show,
    notFound: sources.notFound,
  };
};
