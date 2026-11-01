/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

/** A stored value the designer cannot edit, shown as it is so that nothing overwrites it. */
export function RawAutomationValue(props: { value: unknown }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-subtle bg-layer-1 p-3 text-11 text-secondary">
      {JSON.stringify(props.value, null, 2)}
    </pre>
  );
}
