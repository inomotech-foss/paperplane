/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { describe, expect, it, vi } from "vitest";
import { isApiError } from "@plane/services";
import { sendJson } from "./send-json";

const respond = (body: string, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(body === "" ? null : body, { status }));

describe("sendJson", () => {
  it("posts the body as JSON with the session cookie", async () => {
    const fetchMock = respond('{"ok":true}');
    const data = await sendJson("/api/x/", { email: "a@b.c" }, { baseUrl: "https://api", fetch: fetchMock });

    expect(data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api/api/x/");
    expect(init).toMatchObject({ method: "POST", credentials: "include", body: '{"email":"a@b.c"}' });
  });

  it("returns undefined for an empty body", async () => {
    await expect(sendJson("/api/x/", {}, { baseUrl: "", fetch: respond("", 204) })).resolves.toBeUndefined();
  });

  it("throws an ApiError with the parsed body for a non-2xx status", async () => {
    const error: unknown = await sendJson(
      "/api/x/",
      {},
      { baseUrl: "", fetch: respond('{"error_code":5005}', 400) }
    ).catch((caught: unknown) => caught);

    expect(isApiError(error)).toBe(true);
    if (!isApiError(error)) return;
    expect(error.status).toBe(400);
    expect(error.data).toEqual({ error_code: 5005 });
  });
});
