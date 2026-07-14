/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Meta, StoryObj } from "@storybook/react-vite";
import { HelpCircle } from "lucide-react";
import { Tooltip } from "./root";

const meta = {
  title: "Components/Tooltip",
  component: Tooltip,
  parameters: {
    layout: "centered",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof Tooltip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    tooltipContent: "This is a tooltip",
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">Hover me</button>,
  },
};

export const WithHeading: Story = {
  args: {
    tooltipHeading: "Tooltip Title",
    tooltipContent: "This is the tooltip content with a heading.",
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">Hover me</button>,
  },
};

export const PositionTop: Story = {
  args: {
    tooltipContent: "Tooltip on top",
    position: "top",
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">Top</button>,
  },
};

export const PositionBottom: Story = {
  args: {
    tooltipContent: "Tooltip on bottom",
    position: "bottom",
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">Bottom</button>,
  },
};

export const PositionLeft: Story = {
  args: {
    tooltipContent: "Tooltip on left",
    position: "left",
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">Left</button>,
  },
};

export const PositionRight: Story = {
  args: {
    tooltipContent: "Tooltip on right",
    position: "right",
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">Right</button>,
  },
};

export const WithIcon: Story = {
  args: {
    tooltipContent: "Click here for help",
    children: (
      <button className="hover:bg-gray-100 rounded-full p-2">
        <HelpCircle className="text-gray-600 h-5 w-5" />
      </button>
    ),
  },
};

export const Disabled: Story = {
  args: {
    tooltipContent: "This tooltip is disabled",
    disabled: true,
    children: <button className="bg-gray-400 rounded-sm px-4 py-2 text-on-color">Hover me (disabled)</button>,
  },
};

export const LongContent: Story = {
  args: {
    tooltipHeading: "Important Information",
    tooltipContent:
      "This is a longer tooltip with more detailed information that wraps to multiple lines. It provides comprehensive details about the element.",
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">Long content</button>,
  },
};

export const CustomDelay: Story = {
  args: {
    tooltipContent: "This tooltip has a custom delay",
    openDelay: 1000,
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">Custom delay (1s)</button>,
  },
};

export const CustomOffset: Story = {
  args: {
    tooltipContent: "Custom offset tooltip",
    sideOffset: 20,
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">Custom offset</button>,
  },
};

export const AllPositions: Story = {
  args: {
    children: <div />,
  },
  render() {
    return (
      <div className="flex flex-col items-center gap-4">
        <Tooltip tooltipContent="Top position" position="top">
          <button className="bg-blue-500 rounded-sm px-4 py-2 text-13 text-on-color">Top</button>
        </Tooltip>
        <div className="flex gap-4">
          <Tooltip tooltipContent="Left position" position="left">
            <button className="bg-blue-500 rounded-sm px-4 py-2 text-13 text-on-color">Left</button>
          </Tooltip>
          <Tooltip tooltipContent="Right position" position="right">
            <button className="bg-blue-500 rounded-sm px-4 py-2 text-13 text-on-color">Right</button>
          </Tooltip>
        </div>
        <Tooltip tooltipContent="Bottom position" position="bottom">
          <button className="bg-blue-500 rounded-sm px-4 py-2 text-13 text-on-color">Bottom</button>
        </Tooltip>
      </div>
    );
  },
};

export const OnText: Story = {
  args: {
    children: <div />,
  },
  render() {
    return (
      <p className="text-gray-700 text-13">
        This is some text with a{" "}
        <Tooltip tooltipContent="Additional information about this word" position="top">
          <span className="border-blue-500 text-blue-500 cursor-help border-b border-dashed">tooltip</span>
        </Tooltip>{" "}
        in it.
      </p>
    );
  },
};

export const OnDisabledButton: Story = {
  args: {
    children: <div />,
  },
  render() {
    return (
      <Tooltip tooltipContent="This feature is currently unavailable" position="top">
        <button className="bg-gray-300 text-gray-500 cursor-not-allowed rounded-sm px-4 py-2" disabled>
          Disabled Button
        </button>
      </Tooltip>
    );
  },
};

export const ComplexContent: Story = {
  args: {
    tooltipHeading: "User Information",
    tooltipContent: (
      <div className="space-y-1">
        <p className="font-semibold">John Doe</p>
        <p className="text-11">john@example.com</p>
        <p className="text-gray-400 text-11">Last seen: 2 hours ago</p>
      </div>
    ),
    children: <button className="bg-blue-500 rounded-sm px-4 py-2 text-on-color">View User</button>,
  },
};

export const WithCustomStyling: Story = {
  args: {
    tooltipContent: "Custom styled tooltip",
    className: "bg-purple-500 text-on-color",
    children: <button className="bg-purple-500 rounded-sm px-4 py-2 text-on-color">Custom style</button>,
  },
};

export const MultipleTooltips: Story = {
  args: {
    children: <div />,
  },
  render() {
    return (
      <div className="flex gap-4">
        <Tooltip tooltipContent="Save your work" position="top">
          <button className="bg-green-500 rounded-sm px-4 py-2 text-13 text-on-color">Save</button>
        </Tooltip>
        <Tooltip tooltipContent="Discard changes" position="top">
          <button className="bg-red-500 rounded-sm px-4 py-2 text-13 text-on-color">Cancel</button>
        </Tooltip>
        <Tooltip tooltipContent="Export to PDF" position="top">
          <button className="bg-blue-500 rounded-sm px-4 py-2 text-13 text-on-color">Export</button>
        </Tooltip>
        <Tooltip tooltipContent="Share with team" position="top">
          <button className="bg-purple-500 rounded-sm px-4 py-2 text-13 text-on-color">Share</button>
        </Tooltip>
      </div>
    );
  },
};

export const IconButtons: Story = {
  args: {
    children: <div />,
  },
  render() {
    return (
      <div className="flex gap-2">
        <Tooltip tooltipContent="Edit" position="top">
          <button className="hover:bg-gray-100 rounded-sm p-2">
            <svg
              className="text-gray-600 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.41-9.41a2 2 0 112.83 2.83L11.83 15H9v-2.83l8.59-8.59z"
              />
            </svg>
          </button>
        </Tooltip>
        <Tooltip tooltipContent="Delete" position="top">
          <button className="hover:bg-gray-100 rounded-sm p-2">
            <svg
              className="h-5 w-5 text-danger-primary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-0.87 12.14A2 2 0 116.14 21H7.86a2 2 0 01-2-1.86L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </Tooltip>
        <Tooltip tooltipContent="Share" position="top">
          <button className="hover:bg-gray-100 rounded-sm p-2">
            <svg
              className="text-blue-600 h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.68 13.34C8.89 12.94 9 12.48 9 12c0-0.48-0.11-0.94-0.32-1.34m0 2.68a3 3 0 110-2.68m0 2.68l6.63 3.32m-6.63-6l6.63-3.32m0 0a3 3 0 105.37-2.68 3 3 0 00-5.37 2.68zm0 9.32a3 3 0 105.37 2.68 3 3 0 00-5.37-2.68z"
              />
            </svg>
          </button>
        </Tooltip>
      </div>
    );
  },
};

export const InFormField: Story = {
  args: {
    children: <div />,
  },
  render() {
    return (
      <div className="w-80">
        <label className="text-gray-700 mb-1 flex items-center gap-2 text-13 font-medium">
          Email Address
          <Tooltip
            tooltipHeading="Email Requirements"
            tooltipContent="Enter a valid email address that you have access to. We'll send a verification link."
            position="right"
          >
            <HelpCircle className="text-gray-400 h-4 w-4 cursor-help" />
          </Tooltip>
        </label>
        <input
          type="email"
          className="border-gray-300 w-full rounded-sm border px-3 py-2 text-13"
          placeholder="you@example.com"
        />
      </div>
    );
  },
};
