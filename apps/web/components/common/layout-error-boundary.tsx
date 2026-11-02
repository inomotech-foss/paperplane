/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Component, Fragment } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { LoadErrorState } from "./load-error-state";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  retryKey: number;
};

// Catches render crashes from a single issue layout (list/kanban/spreadsheet/calendar/gantt)
// so a bad group/column shape degrades to a local fallback instead of taking down the whole page.
export class LayoutErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, retryKey: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("Issue layout crashed", error, info);
  }

  handleRetry = () => {
    this.setState((prev) => ({ hasError: false, retryKey: prev.retryKey + 1 }));
  };

  render() {
    if (this.state.hasError) {
      return <LoadErrorState onRetry={this.handleRetry} />;
    }
    return <Fragment key={this.state.retryKey}>{this.props.children}</Fragment>;
  }
}
