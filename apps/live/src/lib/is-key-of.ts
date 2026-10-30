/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export const isKeyOf = <T extends object>(obj: T, key: PropertyKey): key is keyof T => Object.hasOwn(obj, key);
