/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type * as React from "react";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@plane/utils";

/** Lifts an element above the card link so it gets its own clicks and hover. */
export const clickableCardRaisedClassName = "relative z-[2]";

export type ClickableCardProps = useRender.ComponentProps<"div">;

/**
 * A card or row that is one big link but can still hold its own controls.
 * It starts a stacking context, so the raised layers never paint over unrelated UI.
 */
export function ClickableCard(props: ClickableCardProps) {
  const { render, className, ref, ...rest } = props;
  return useRender({
    render,
    ref,
    props: { ...rest, className: cn("relative isolate", className) },
  });
}

export type ClickableCardLinkRenderProps = React.ComponentPropsWithRef<"a"> & { href: string };

export type ClickableCardLinkProps = Omit<React.ComponentPropsWithRef<"a">, "href"> & {
  href: string;
  /**
   * Runs on a plain primary click only. Modified and middle clicks keep the native link behaviour,
   * so they open in a new tab. Call `preventDefault` to stop the navigation.
   */
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  /** Renders the children as plain text without a link. */
  disabled?: boolean;
  /** Renders a router link instead of a plain anchor, for example `(props) => <Link {...props} />`. */
  render?: (props: ClickableCardLinkRenderProps) => React.ReactElement;
};

const isModifiedClick = (event: React.MouseEvent) =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/**
 * The link that covers the whole `ClickableCard`. Use the title as children, or leave it empty and
 * give it an `aria-label`. No positioned element may sit between it and the card, or the link only
 * covers that element.
 */
export function ClickableCardLink(props: ClickableCardLinkProps) {
  const { onClick, disabled = false, render, className, children, draggable = false, ...rest } = props;

  if (disabled) {
    if (children === undefined) return null;
    return <span className={className}>{children}</span>;
  }

  const linkProps: ClickableCardLinkRenderProps = {
    ...rest,
    draggable,
    className: cn(
      "outline-none after:absolute after:inset-0 after:z-[1] focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-accent-strong",
      className
    ),
    onClick: (event) => {
      if (isModifiedClick(event)) return;
      onClick?.(event);
    },
  };

  return render ? render({ ...linkProps, children }) : <a {...linkProps}>{children}</a>;
}

export type ClickableCardRaisedProps = useRender.ComponentProps<"div">;

/** Wraps controls that must stay clickable above the card link. */
export function ClickableCardRaised(props: ClickableCardRaisedProps) {
  const { render, className, ref, ...rest } = props;
  return useRender({
    render,
    ref,
    props: { ...rest, className: cn(clickableCardRaisedClassName, className) },
  });
}
