import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// The real hook polls for a web font on a timer that can outlive the test environment.
vi.mock("use-font-face-observer", () => ({ default: () => true }));

afterEach(() => {
  cleanup();
});
