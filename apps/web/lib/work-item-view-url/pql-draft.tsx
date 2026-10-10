// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { createContext, useContext } from "react";
import type { TPqlDraft } from "./resolve";

const PqlDraftContext = createContext<TPqlDraft | undefined>(undefined);

/** Passes the draft a route's loader returned down to the query bar. */
export const PqlDraftProvider = PqlDraftContext.Provider;

export const usePqlDraft = (): TPqlDraft | undefined => useContext(PqlDraftContext);
