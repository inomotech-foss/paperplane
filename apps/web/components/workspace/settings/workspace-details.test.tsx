// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WorkspaceDetails } from "./workspace-details";

const updateWorkspace = vi.fn();
let isAdmin = true;
// One object across renders, as the store gives; a fresh one would re-run the form's reset effect forever.
const currentWorkspace = {
  slug: "ws",
  name: "Workspace",
  url: "",
  logo_url: null,
  timezone: "UTC",
  pql_dialect: "jql",
};

vi.mock("@plane/i18n", () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock("@plane/blocks/toast", () => ({ setToast: vi.fn() }));
vi.mock("@/components/core/modals/workspace-image-upload-modal", () => ({ WorkspaceImageUploadModal: () => null }));
vi.mock("@/components/global/timezone-select", () => ({ TimezoneSelect: () => null }));
vi.mock("@/components/workspace/delete-workspace-section", () => ({ DeleteWorkspaceSection: () => null }));
vi.mock("@/hooks/store/use-workspace", () => ({
  useWorkspace: () => ({ currentWorkspace, updateWorkspace }),
}));
vi.mock("@/hooks/store/user", () => ({ useUserPermissions: () => ({ allowPermissions: () => isAdmin }) }));

/** Base UI commits a mouse pick only when the press started on the option. */
const pick = async (name: string) => {
  const option = await screen.findByRole("option", { name });
  fireEvent.pointerDown(option, { pointerType: "mouse" });
  fireEvent.click(option);
};

const dialectSelect = () => screen.getByRole("combobox", { name: "workspace_settings.settings.general.pql_dialect" });

describe("WorkspaceDetails PQL dialect", () => {
  beforeEach(() => {
    updateWorkspace.mockReset().mockResolvedValue({});
    isAdmin = true;
  });

  it("saves the dialect an admin picks", async () => {
    render(<WorkspaceDetails />);
    expect(dialectSelect().textContent).toContain("JQL");

    fireEvent.click(dialectSelect());
    await pick("Plane");
    fireEvent.click(screen.getByRole("button", { name: "workspace_settings.settings.general.update_workspace" }));

    await waitFor(() =>
      expect(updateWorkspace).toHaveBeenCalledWith("ws", expect.objectContaining({ pql_dialect: "plane" }))
    );
  });

  it("shows the dialect to members without letting them change it", () => {
    isAdmin = false;
    render(<WorkspaceDetails />);
    expect(dialectSelect().hasAttribute("data-disabled")).toBe(true);
  });
});
