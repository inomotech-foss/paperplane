// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import type { UploadXhr } from "../client/upload";
import { uploadToPresignedPost } from "./presigned-upload";

const fields = {
  "Content-Type": "image/png",
  key: "ws/asset.png",
  "x-amz-algorithm": "AWS4-HMAC-SHA256",
  "x-amz-credential": "cred",
  "x-amz-date": "20261030T000000Z",
  policy: "policy",
  "x-amz-signature": "sig",
};

describe("uploadToPresignedPost", () => {
  it("POSTs the signed fields followed by the file to the signed URL", async () => {
    let sent: { url: string; body: FormData } | undefined;
    let onLoad: (() => void) | undefined;
    const xhr: UploadXhr = {
      withCredentials: true,
      status: 204,
      statusText: "No Content",
      responseText: "",
      upload: { addEventListener: vi.fn() },
      open: (_method, url) => {
        sent = { url, body: new FormData() };
      },
      send: (body) => {
        if (sent) sent.body = body;
        onLoad?.();
      },
      abort: vi.fn(),
      getAllResponseHeaders: () => "",
      addEventListener: (type, listener) => {
        if (type === "load") onLoad = listener;
      },
    };
    const file = new File(["png"], "asset.png", { type: "image/png" });

    await uploadToPresignedPost({ upload_data: { url: "https://bucket.test/", fields } }, file, {
      createXhr: () => xhr,
    });

    expect(sent?.url).toBe("https://bucket.test/");
    const entries = [...(sent?.body.entries() ?? [])];
    expect(entries.map(([key]) => key)).toEqual([...Object.keys(fields), "file"]);
    expect(sent?.body.get("key")).toBe("ws/asset.png");
    expect(sent?.body.get("file")).toBeInstanceOf(File);
  });
});
