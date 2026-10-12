// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { TInstanceMs365ConfigurationKeys } from "@plane/types";

type TMs365CredentialField = {
  key: TInstanceMs365ConfigurationKeys;
  type: "text" | "password";
  label: string;
  description: string;
  placeholder: string;
  error: boolean;
  required: boolean;
};

// Outgoing email and the service desk share one app registration.
export const getMs365CredentialFields = (
  errors: Partial<Record<TInstanceMs365ConfigurationKeys, unknown>>,
  required: boolean
): TMs365CredentialField[] => [
  {
    key: "MS365_TENANT_ID",
    type: "text",
    label: "Tenant ID",
    description: "The directory (tenant) ID of your Microsoft Entra ID tenant.",
    placeholder: "00000000-0000-0000-0000-000000000000",
    error: Boolean(errors.MS365_TENANT_ID),
    required,
  },
  {
    key: "MS365_CLIENT_ID",
    type: "text",
    label: "Client ID",
    description: "The application (client) ID of your Microsoft 365 app registration.",
    placeholder: "00000000-0000-0000-0000-000000000000",
    error: Boolean(errors.MS365_CLIENT_ID),
    required,
  },
  {
    key: "MS365_CLIENT_SECRET",
    type: "password",
    label: "Client secret",
    description: "A client secret created for the app registration.",
    placeholder: "Client secret",
    error: Boolean(errors.MS365_CLIENT_SECRET),
    required,
  },
];
