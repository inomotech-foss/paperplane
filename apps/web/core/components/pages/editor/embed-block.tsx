/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { observer } from "mobx-react";
// plane imports
import type { TEmbedRenderProps } from "@plane/editor";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/propel/button";
import { Input } from "@plane/ui";
// hooks
import { useInstance } from "@/hooks/store/use-instance";

const DEFAULT_WIDTH = "100%";
const DEFAULT_HEIGHT = "480px";
const SIZE_PATTERN = /^\d+(px|%)?$/;

/**
 * `nh3` does not scheme-check attributes on the embed-component custom tag, so
 * a stored HTML document can carry a javascript: URL straight through
 * sanitisation. Only http(s) is ever handed to an href or an iframe src.
 */
function parseEmbeddableUrl(url: string | null): URL | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * The allowlist is compared on the origin alone, so a path or trailing slash
 * in either side can neither widen nor narrow what actually gets framed.
 */
function isOriginAllowed(origin: string, allowedOrigins: string[] | undefined): boolean {
  if (!allowedOrigins?.length) return false;
  const target = origin.toLowerCase();
  return allowedOrigins.some((entry) => {
    try {
      return new URL(entry).origin.toLowerCase() === target;
    } catch {
      return false;
    }
  });
}

function resolveDimension(value: string | null, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed || !SIZE_PATTERN.test(trimmed)) return fallback;
  return /(px|%)$/.test(trimmed) ? trimmed : `${trimmed}px`;
}

export const PageEmbedBlock = observer(function PageEmbedBlock(props: TEmbedRenderProps) {
  const { url, width, height, onUrlChange } = props;
  const { config } = useInstance();
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState(false);

  const parsedUrl = parseEmbeddableUrl(url);

  if (!parsedUrl) {
    if (!onUrlChange) {
      return (
        <div className="rounded-md border border-subtle px-2 py-1.5">
          <p className="px-2 py-1.5 text-13 text-tertiary">{t("page_embed.empty_state")}</p>
        </div>
      );
    }

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = inputValue.trim();
      if (!parseEmbeddableUrl(trimmed)) {
        setError(true);
        return;
      }
      setError(false);
      onUrlChange(trimmed);
    };

    return (
      <form onSubmit={handleSubmit} className="flex flex-col gap-1.5 rounded-md border border-subtle p-2">
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              setError(false);
            }}
            placeholder={t("page_embed.url_input_placeholder")}
            className="w-full"
            hasError={error}
          />
          <Button type="submit" variant="secondary" size="sm">
            {t("page_embed.submit_button")}
          </Button>
        </div>
        {error && <span className="text-11 text-danger-primary">{t("page_embed.invalid_url_error")}</span>}
      </form>
    );
  }

  const allowed = isOriginAllowed(parsedUrl.origin, config?.external_embed_allowed_origins);
  const link = (
    <a
      href={parsedUrl.href}
      target="_blank"
      rel="noreferrer noopener"
      className="truncate text-13 text-link-primary hover:underline"
    >
      {parsedUrl.href}
    </a>
  );

  if (!allowed) {
    return (
      <div className="space-y-1 rounded-md border border-subtle px-3 py-2">
        {link}
        <p className="text-11 text-tertiary">{t("page_embed.origin_not_allowed")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <iframe
        src={parsedUrl.href}
        // Only an allowlisted origin ever reaches this iframe; every other
        // origin renders as a plain link above, so a stored URL cannot use
        // the sandbox's allow-same-origin to script this page's parent.
        // oxlint-disable-next-line react/iframe-missing-sandbox, react-doctor/iframe-missing-sandbox
        sandbox="allow-scripts allow-same-origin"
        referrerPolicy="no-referrer"
        loading="lazy"
        title={t("page_embed.iframe_title")}
        style={{ width: resolveDimension(width, DEFAULT_WIDTH), height: resolveDimension(height, DEFAULT_HEIGHT) }}
        className="rounded-md border border-subtle"
      />
      {link}
    </div>
  );
});
