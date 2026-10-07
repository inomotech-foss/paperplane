// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

// Compile-time checks; `tsc --noEmit` fails when one breaks.
import type { AdminApiPath, ApiMethod, ApiRequestBody, ApiResponse, ApiSchema } from "./index";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

type StatesPath = "/api/workspaces/{slug}/projects/{project_id}/states/";
type StatePath = "/api/workspaces/{slug}/projects/{project_id}/states/{pk}/";
type MarkDefaultPath = "/api/workspaces/{slug}/projects/{project_id}/states/{pk}/mark-default/";

export type Checks = [
  Expect<Equal<ApiMethod<StatesPath>, "get" | "post">>,
  Expect<Equal<ApiMethod<StatePath>, "get" | "patch" | "delete">>,
  Expect<Equal<ApiResponse<StatesPath, "get">, ApiSchema<"OrderedState">[]>>,
  Expect<Equal<ApiResponse<StatesPath, "post">, ApiSchema<"ProjectState">>>,
  Expect<Equal<ApiRequestBody<StatesPath, "post">, ApiSchema<"StateRequest">>>,
  Expect<Equal<ApiRequestBody<StatePath, "patch">, ApiSchema<"PatchedStateRequest">>>,
  Expect<Equal<ApiResponse<MarkDefaultPath, "post">, undefined>>,
  Expect<Equal<ApiRequestBody<MarkDefaultPath, "post">, never>>,
  Expect<Equal<ApiSchema<"ProjectState">["id"], string>>,
  Expect<Equal<Extract<AdminApiPath, `/api/v1/${string}`>, never>>,
];
