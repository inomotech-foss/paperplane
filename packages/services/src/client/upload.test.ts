// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { describe, expect, it, vi } from "vitest";
import { isApiError } from "./api-error";
import { toUploadProgress, uploadForm } from "./upload";
import type { UploadProgress, UploadXhr } from "./upload";

type ProgressListener = (event: { loaded: number; total: number; lengthComputable: boolean }) => void;
type EventName = "load" | "error" | "abort" | "timeout";

class FakeXhr implements UploadXhr {
  withCredentials = true;
  status = 0;
  statusText = "";
  responseText = "";
  responseHeaders = "";
  method = "";
  url = "";
  body: FormData | undefined;
  private progressListeners: ProgressListener[] = [];
  private listeners = new Map<EventName, (() => void)[]>();

  readonly upload = {
    addEventListener: (_type: "progress", listener: ProgressListener) => {
      this.progressListeners.push(listener);
    },
  };

  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }

  send(body: FormData) {
    this.body = body;
  }

  abort() {
    this.emit("abort");
  }

  getAllResponseHeaders() {
    return this.responseHeaders;
  }

  addEventListener(type: EventName, listener: () => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  emit(type: EventName) {
    for (const listener of this.listeners.get(type) ?? []) listener();
  }

  progress(loaded: number, total: number, lengthComputable = true) {
    for (const listener of this.progressListeners) listener({ loaded, total, lengthComputable });
  }

  respond(status: number, text = "", headers = "") {
    this.status = status;
    this.responseText = text;
    this.responseHeaders = headers;
    this.emit("load");
  }
}

function setup() {
  const xhr = new FakeXhr();
  return { xhr, createXhr: () => xhr };
}

const form = () => {
  const body = new FormData();
  body.append("key", "a/b.png");
  return body;
};

describe("uploadForm", () => {
  it("POSTs the form without credentials and resolves on 2xx", async () => {
    const { xhr, createXhr } = setup();
    const body = form();
    const upload = uploadForm("https://bucket.test/", body, { createXhr });
    xhr.respond(204);
    await expect(upload).resolves.toBeUndefined();
    expect(xhr).toMatchObject({ method: "POST", url: "https://bucket.test/", withCredentials: false });
    expect(xhr.body).toBe(body);
  });

  it("reports progress as axios did", async () => {
    const { xhr, createXhr } = setup();
    const events: UploadProgress[] = [];
    const upload = uploadForm("https://bucket.test/", form(), { createXhr, onProgress: (p) => events.push(p) });
    xhr.progress(25, 100);
    xhr.progress(100, 100);
    xhr.respond(204);
    await upload;
    expect(events).toEqual([
      { loaded: 25, total: 100, progress: 0.25 },
      { loaded: 100, total: 100, progress: 1 },
    ]);
  });

  it("throws an ApiError with the parsed body for a non-2xx status", async () => {
    const { xhr, createXhr } = setup();
    const upload = uploadForm("https://bucket.test/", form(), { createXhr });
    xhr.respond(403, '{"error":"denied"}', "Content-Type: application/json\r\nX-Id: 1\r\n");
    const error: unknown = await upload.catch((e: unknown) => e);
    expect(isApiError(error)).toBe(true);
    expect(error).toMatchObject({ status: 403, data: { error: "denied" }, error: "denied" });
    expect(isApiError(error) && error.response.headers.get("x-id")).toBe("1");
  });

  it("keeps a non-JSON error body as text", async () => {
    const { xhr, createXhr } = setup();
    const upload = uploadForm("https://bucket.test/", form(), { createXhr });
    xhr.respond(400, "<Error><Code>EntityTooLarge</Code></Error>");
    await expect(upload).rejects.toMatchObject({ status: 400, data: "<Error><Code>EntityTooLarge</Code></Error>" });
  });

  it("has undefined data for an empty error body", async () => {
    const { xhr, createXhr } = setup();
    const upload = uploadForm("https://bucket.test/", form(), { createXhr });
    xhr.respond(502);
    const error: unknown = await upload.catch((e: unknown) => e);
    expect(isApiError(error) && error.data).toBeUndefined();
  });

  it("throws a TypeError on a network error", async () => {
    const { xhr, createXhr } = setup();
    const upload = uploadForm("https://bucket.test/", form(), { createXhr });
    xhr.emit("error");
    await expect(upload).rejects.toBeInstanceOf(TypeError);
  });

  it("aborts the request and rejects with the signal's reason", async () => {
    const { xhr, createXhr } = setup();
    const abort = vi.spyOn(xhr, "abort");
    const controller = new AbortController();
    const upload = uploadForm("https://bucket.test/", form(), { createXhr, signal: controller.signal });
    controller.abort();
    const error: unknown = await upload.catch((e: unknown) => e);
    expect(abort).toHaveBeenCalledOnce();
    expect(error).toBe(controller.signal.reason);
    expect(error).toMatchObject({ name: "AbortError" });
  });

  it("does not send when the signal is already aborted", async () => {
    const createXhr = vi.fn(() => new FakeXhr());
    const upload = uploadForm("https://bucket.test/", form(), { createXhr, signal: AbortSignal.abort() });
    await expect(upload).rejects.toMatchObject({ name: "AbortError" });
    expect(createXhr).not.toHaveBeenCalled();
  });
});

describe("toUploadProgress", () => {
  it("has no total or progress when the length is unknown", () => {
    expect(toUploadProgress({ loaded: 10, total: 0, lengthComputable: false })).toEqual({
      loaded: 10,
      total: undefined,
      progress: undefined,
    });
  });

  it("caps loaded at total", () => {
    expect(toUploadProgress({ loaded: 120, total: 100, lengthComputable: true })).toEqual({
      loaded: 100,
      total: 100,
      progress: 1,
    });
  });
});
