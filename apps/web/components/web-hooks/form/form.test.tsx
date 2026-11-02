// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@plane/services";
import { WebhookForm } from "./form";

vi.mock("@/hooks/store/use-webhook", () => ({ useWebhook: () => ({ webhookSecretKey: undefined }) }));

describe("WebhookForm", () => {
  it("shows a refused URL on the field", async () => {
    const onSubmit = vi.fn(async () => {
      throw new ApiError(new Response(null, { status: 400 }), { url: "Invalid or disallowed webhook URL." });
    });
    render(<WebhookForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "http://localhost/" } });
    fireEvent.submit(screen.getByRole("textbox").closest("form")!);
    expect(await screen.findByText("Invalid or disallowed webhook URL.")).toBeTruthy();
  });
});
