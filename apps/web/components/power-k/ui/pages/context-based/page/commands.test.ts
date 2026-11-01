/**
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { usePowerKPageContextBasedActions } from "./commands";

vi.mock("next/navigation", () => ({ useParams: () => ({ pageId: "page-1" }) }));
vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/hooks/store", () => ({
  EPageStoreType: { PROJECT: "PROJECT_PAGE" },
  usePageStore: () => ({ getPageById: () => undefined }),
}));

describe("usePowerKPageContextBasedActions", () => {
  it("leaves lock, access and archive to the palette, without a keyboard shortcut", () => {
    const { result } = renderHook(() => usePowerKPageContextBasedActions());
    const stateChanging = result.current.filter((command) =>
      ["toggle_page_lock", "toggle_page_access", "toggle_page_archive"].includes(command.id)
    );

    expect(stateChanging).toHaveLength(3);
    for (const command of stateChanging) {
      expect(command.shortcut ?? command.keySequence ?? command.modifierShortcut).toBeUndefined();
    }
  });
});
