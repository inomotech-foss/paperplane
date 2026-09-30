/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { HideOutline, ShowOutline } from "@makeplane/propel/icons";

type Props = {
  id: string;
  label: string;
  value: string | undefined;
  placeholder: string;
  isVisible: boolean;
  onChange: (value: string) => void;
  onToggleVisibility: () => void;
  onFocus: () => void;
  onBlur: () => void;
  minLength?: number;
  focusOnMount?: boolean;
  /** Rendered below the input, e.g. a strength indicator or a mismatch error. */
  children?: ReactNode;
};

/** Password input with a show/hide toggle, shared by the set and reset password forms. */
export function PasswordField(props: Props) {
  const {
    id,
    label,
    value,
    placeholder,
    isVisible,
    onChange,
    onToggleVisibility,
    onFocus,
    onBlur,
    minLength,
    focusOnMount,
    children,
  } = props;

  return (
    <div className="space-y-1">
      <label className="text-13 font-medium text-tertiary" htmlFor={id}>
        {label}
      </label>
      <InputGroup size="2xl">
        <Input
          size="2xl"
          type={isVisible ? "text" : "password"}
          name={id}
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          minLength={minLength}
          onFocus={onFocus}
          onBlur={onBlur}
          autoComplete="new-password"
          // oxlint-disable-next-line jsx_a11y/no-autofocus
          autoFocus={focusOnMount}
        />
        <button
          type="button"
          onClick={onToggleVisibility}
          className="grid size-5 place-items-center"
          aria-label={isVisible ? "Hide password" : "Show password"}
        >
          {isVisible ? (
            <HideOutline className="size-5 text-placeholder" />
          ) : (
            <ShowOutline className="size-5 text-placeholder" />
          )}
        </button>
      </InputGroup>
      {children}
    </div>
  );
}
