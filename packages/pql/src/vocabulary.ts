// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

export type FieldInfo = {
  name: string;
  aliases: string[];
  type: "uuid" | "text" | "date";
  // Django lookups the field supports: exact, in, gt, gte, lt, lte, icontains, isnull.
  lookups: string[];
  // PQL operator strings the field accepts, in display order.
  operators: string[];
  choices: string[] | null;
  // Values are people, so currentUser() applies.
  people?: boolean;
};

export type FunctionInfo = {
  name: string;
  // A condition stands alone; a value follows an operator.
  kind: "condition" | "value";
};

export type Vocabulary = {
  fields: FieldInfo[];
  functions: FunctionInfo[];
  // Entity names for a field, or custom property names when `field` is "cf".
  valuesFor?: (field: string, prefix: string) => Promise<string[]>;
};

export function findField(vocabulary: Vocabulary, name: string): FieldInfo | undefined {
  const wanted = name.toLowerCase();
  return vocabulary.fields.find((field) => field.name === wanted || field.aliases.includes(wanted));
}
