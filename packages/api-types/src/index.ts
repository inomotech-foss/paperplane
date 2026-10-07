// SPDX-License-Identifier: AGPL-3.0-only
// See the LICENSE file for details.

import type { HttpMethod, SuccessResponseJSON } from "openapi-typescript-helpers";
import type { components as AdminComponents, paths as AdminPaths } from "./generated/admin";
import type { components as InternalComponents, paths as InternalPaths } from "./generated/internal";
import type { components as V1Components, paths as V1Paths } from "./generated/v1";

export type { AdminComponents, AdminPaths, HttpMethod, InternalComponents, InternalPaths, V1Components, V1Paths };

/** The HTTP methods that `Paths[P]` defines. */
export type MethodOf<Paths, P extends keyof Paths> = {
  [M in HttpMethod]: Paths[P] extends { [K in M]: object } ? M : never;
}[HttpMethod];

/** The operation object of a path and method. */
export type OperationOf<Paths, P extends keyof Paths, M extends MethodOf<Paths, P>> = Paths[P] extends {
  [K in M]: infer Operation;
}
  ? Operation
  : never;

/** The JSON body of the success response. `undefined` when the response has no body. */
export type ResponseOf<Paths, P extends keyof Paths, M extends MethodOf<Paths, P>> =
  OperationOf<Paths, P, M> extends Record<string, unknown> ? SuccessResponseJSON<OperationOf<Paths, P, M>> : never;

type JsonContent<Body> = Body extends { content: { "application/json": infer Content } } ? Content : never;

/** The JSON request body. `never` when the operation takes no body. */
export type RequestBodyOf<Paths, P extends keyof Paths, M extends MethodOf<Paths, P>> =
  OperationOf<Paths, P, M> extends { requestBody?: infer Body } ? JsonContent<NonNullable<Body>> : never;

/** A path of the internal API that the web and space apps call. */
export type ApiPath = keyof InternalPaths;

export type ApiMethod<P extends ApiPath> = MethodOf<InternalPaths, P>;

/** @example ApiResponse<"/api/workspaces/{slug}/projects/{project_id}/states/", "get"> */
export type ApiResponse<P extends ApiPath, M extends ApiMethod<P>> = ResponseOf<InternalPaths, P, M>;

export type ApiRequestBody<P extends ApiPath, M extends ApiMethod<P>> = RequestBodyOf<InternalPaths, P, M>;

/** @example ApiSchema<"State"> */
export type ApiSchema<N extends keyof InternalComponents["schemas"]> = InternalComponents["schemas"][N];

export type AdminApiPath = keyof AdminPaths;

export type AdminApiResponse<P extends AdminApiPath, M extends MethodOf<AdminPaths, P>> = ResponseOf<AdminPaths, P, M>;

export type AdminApiSchema<N extends keyof AdminComponents["schemas"]> = AdminComponents["schemas"][N];
