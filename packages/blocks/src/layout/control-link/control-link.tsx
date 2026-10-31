/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import * as React from "react";

export type TControlLink = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  children: React.ReactNode;
  target?: string;
  disabled?: boolean;
  className?: string;
  draggable?: boolean;
};

export const ControlLink = React.forwardRef(function ControlLink(
  props: TControlLink,
  ref: React.ForwardedRef<HTMLElement>
) {
  const { href, onClick, children, target = "_blank", disabled = false, className, draggable = false, ...rest } = props;
  // The disabled form renders a span, so the forwarded ref is typed for any element.
  const setRef = React.useCallback(
    (node: HTMLElement | null) => {
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref]
  );
  const LEFT_CLICK_EVENT_CODE = 0;

  const handleOnClick = (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
    const clickCondition = (event.metaKey || event.ctrlKey) && event.button === LEFT_CLICK_EVENT_CODE;
    if (!clickCondition) {
      event.preventDefault();
      onClick(event);
    }
  };

  // if disabled but still has a ref or a className then it has to be rendered as a non-link wrapper:
  // an href-less anchor is unreachable by keyboard yet still reads as a link. The ref only ever needs
  // plain HTMLElement behaviour (measuring, outside clicks, drag handles), which a span provides.
  if (disabled && (ref || className))
    return (
      <span ref={setRef} className={className}>
        {children}
      </span>
    );

  // else if just disabled return without the parent wrapper
  if (disabled) return <>{children}</>;

  return (
    <a
      href={href}
      target={target}
      onClick={handleOnClick}
      {...rest}
      ref={setRef}
      className={className}
      draggable={draggable}
    >
      {children}
    </a>
  );
});

ControlLink.displayName = "ControlLink";
