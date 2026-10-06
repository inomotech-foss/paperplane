// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { Vocabulary } from "@plane/pql";
import type { TWorkItemQueryFields } from "@plane/types";

// Fields whose values are workspace members.
const PEOPLE_FIELDS = new Set(["assignees__id", "created_by"]);

export type ValuesFor = Vocabulary["valuesFor"];

/** The fields endpoint payload in the shape the editor package completes from. */
export const toVocabulary = (fields: TWorkItemQueryFields | undefined, valuesFor?: ValuesFor): Vocabulary => ({
  fields: (fields?.fields ?? []).map((field) => ({
    name: field.name,
    aliases: field.aliases,
    type: field.type,
    lookups: field.lookups,
    choices: field.choices,
    people: PEOPLE_FIELDS.has(field.name),
  })),
  functions: fields?.functions ?? [],
  valuesFor,
});
