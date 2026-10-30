// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { ApiError } from "./api-error";

/** Upload progress with the same values axios reported in `onUploadProgress`. */
export type UploadProgress = {
  loaded: number;
  /** `undefined` when the browser cannot compute the length. */
  total: number | undefined;
  /** `loaded / total` between 0 and 1, or `undefined` without a total. */
  progress: number | undefined;
};

export type UploadProgressHandler = (progress: UploadProgress) => void;

type ProgressEventLike = { loaded: number; total: number; lengthComputable: boolean };

/** The part of `XMLHttpRequest` the upload uses. */
export type UploadXhr = {
  open(method: string, url: string): void;
  send(body: FormData): void;
  abort(): void;
  withCredentials: boolean;
  readonly status: number;
  readonly statusText: string;
  readonly responseText: string;
  getAllResponseHeaders(): string;
  readonly upload: { addEventListener(type: "progress", listener: (event: ProgressEventLike) => void): void };
  addEventListener(type: "load" | "error" | "abort" | "timeout", listener: () => void): void;
};

export type UploadOptions = {
  onProgress?: UploadProgressHandler;
  signal?: AbortSignal;
  /** Sends cookies. Off by default because uploads go to storage, not to the API. */
  withCredentials?: boolean;
  /** Replaces `new XMLHttpRequest()`, e.g. in tests. */
  createXhr?: () => UploadXhr;
};

export function toUploadProgress(event: ProgressEventLike): UploadProgress {
  const total = event.lengthComputable ? event.total : undefined;
  const loaded = Math.max(0, total === undefined ? event.loaded : Math.min(event.loaded, total));
  return { loaded, total, progress: total ? loaded / total : undefined };
}

function parseHeaders(raw: string): Headers {
  const headers = new Headers();
  for (const line of raw.split(/\r?\n/)) {
    const index = line.indexOf(":");
    if (index <= 0) continue;
    try {
      headers.append(line.slice(0, index).trim(), line.slice(index + 1).trim());
    } catch {
      // Skip a header the Headers class rejects.
    }
  }
  return headers;
}

// Same as openapi-fetch: JSON when it parses, the text otherwise.
function parseBody(text: string): unknown {
  try {
    const data: unknown = JSON.parse(text);
    return data;
  } catch {
    return text;
  }
}

function toApiError(xhr: UploadXhr): ApiError {
  const text = xhr.responseText;
  const response = new Response(text === "" || xhr.status === 304 ? null : text, {
    status: xhr.status,
    statusText: xhr.statusText,
    headers: parseHeaders(xhr.getAllResponseHeaders()),
  });
  return new ApiError(response, parseBody(text));
}

function abortReason(signal: AbortSignal | undefined): unknown {
  return signal?.reason ?? new DOMException("The upload was aborted.", "AbortError");
}

/**
 * POSTs a form with XMLHttpRequest, which unlike fetch reports upload progress.
 *
 * Fails like `unwrap`: an `ApiError` for a non-2xx status, a `TypeError` for a network error and the
 * signal's reason when aborted.
 */
export function uploadForm(url: string, body: FormData, options: UploadOptions = {}): Promise<void> {
  const { onProgress, signal, withCredentials = false, createXhr = () => new XMLHttpRequest() } = options;
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const xhr = createXhr();
    const onAbort = () => xhr.abort();
    const settle = (finish: () => void) => {
      signal?.removeEventListener("abort", onAbort);
      finish();
    };

    xhr.open("POST", url);
    xhr.withCredentials = withCredentials;
    if (onProgress) xhr.upload.addEventListener("progress", (event) => onProgress(toUploadProgress(event)));
    xhr.addEventListener("load", () =>
      settle(() => {
        if (xhr.status >= 200 && xhr.status < 300) resolve();
        else if (xhr.status >= 300 && xhr.status <= 599) reject(toApiError(xhr));
        else reject(new TypeError("Failed to upload"));
      })
    );
    xhr.addEventListener("error", () => settle(() => reject(new TypeError("Failed to upload"))));
    xhr.addEventListener("timeout", () => settle(() => reject(new TypeError("Upload timed out"))));
    xhr.addEventListener("abort", () => settle(() => reject(abortReason(signal))));
    signal?.addEventListener("abort", onAbort, { once: true });
    xhr.send(body);
  });
}
