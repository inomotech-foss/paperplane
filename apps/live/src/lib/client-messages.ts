/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { beforeHandleMessagePayload } from "@hocuspocus/server";
import { MessageType } from "@hocuspocus/server";

const readVarUint = (bytes: Uint8Array, start: number): { value: number; next: number } | null => {
  let value = 0;
  let shift = 0;
  for (let pos = start; pos < bytes.length; pos++) {
    const byte = bytes[pos];
    value += (byte & 0x7f) * 2 ** shift;
    if (byte < 0x80) return { value, next: pos + 1 };
    shift += 7;
  }
  return null;
};

/** The message type after the document name, or null for a malformed frame. */
export const readClientMessageType = (frame: Uint8Array): number | null => {
  const nameLength = readVarUint(frame, 0);
  if (!nameLength) return null;
  return readVarUint(frame, nameLength.next + nameLength.value)?.value ?? null;
};

/**
 * Hocuspocus relays a client's BroadcastStateless frame to every connection on the document unchecked.
 * Only the server broadcasts, so a client frame of that type is refused and its connection closed.
 */
export const beforeHandleMessage = ({ update }: beforeHandleMessagePayload): Promise<void> => {
  if (readClientMessageType(update) === MessageType.BroadcastStateless) {
    return Promise.reject(new Error("Clients may not broadcast stateless messages"));
  }
  return Promise.resolve();
};
