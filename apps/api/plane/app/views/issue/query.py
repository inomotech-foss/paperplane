# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Plane Query Language on the app (session) API.

The web app filters work items with the rich filter JSON the filter bar
builds. A person who wants to ask a question that spans the hierarchy, such as
"every invoice of customer Acme that is paid and due in 2026", writes it as a
PQL expression instead:

    descendantOf("CUST-1") AND type = "Invoice" AND state = "Paid" AND due_date >= "2026-01-01"

`filter_by_pql` applies the `pql` query parameter on top of whatever other
filters a list endpoint already applies, and the validate endpoint gives the
query bar its inline feedback (syntax errors with a position, unknown names).
"""

from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ROLE, allow_permission
from plane.app.views.base import BaseAPIView
from plane.utils.pql import WorkItemFilterError, compile_pql, parse_pql
from plane.utils.pql.fields import FILTER_FIELDS, UNSUPPORTED_FIELDS
from plane.utils.pql.lexer import PQLSyntaxError
from plane.utils.pql.parser import FIELD_ALIASES, FUNCTIONS


def pql_param(request):
    """The `pql` query parameter, or None when absent or blank."""
    raw = request.GET.get("pql")
    return raw.strip() if raw and raw.strip() else None


def filter_by_pql(request, slug, queryset, project_id=None):
    """Apply the request's `pql` parameter to a work item queryset.

    Returns `(queryset, error_response)`; the response is None on success.
    """
    source = pql_param(request)
    if source is None:
        return queryset, None
    try:
        compiled = compile_pql(source, request.user, slug, project_id=project_id)
    except WorkItemFilterError as exc:
        return queryset, Response(exc.payload, status=status.HTTP_400_BAD_REQUEST)
    return queryset.filter(compiled.q).distinct(), None


def without_sub_issue_toggle(filters, request):
    """Drop the `sub_issue=false` root-only restriction when a PQL query is set.

    A query decides for itself which items match; hiding every match that has
    a parent would make "all invoices of a customer" return nothing, since
    invoices always have one.
    """
    if pql_param(request) is not None:
        filters = {key: value for key, value in filters.items() if key != "parent__isnull"}
    return filters


class WorkItemQueryValidateEndpoint(BaseAPIView):
    """Parse and resolve a PQL expression without running it.

    POST `{"pql": "...", "project_id": "<optional>"}` answers 200 with either
    `{"valid": true, "expression": <filters AST>}` or `{"valid": false, ...}`
    carrying the same payload a list endpoint would reject the query with
    (`error`, and for syntax errors `position`, `line`, `column`, `token`,
    `expected`).
    """

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def post(self, request, slug):
        source = request.data.get("pql")
        if not isinstance(source, str) or not source.strip():
            return Response({"valid": False, "error": "Provide a 'pql' expression"}, status=status.HTTP_200_OK)
        project_id = request.data.get("project_id") or None
        try:
            expression = parse_pql(source)
        except PQLSyntaxError as exc:
            return Response({"valid": False, **exc.as_dict()}, status=status.HTTP_200_OK)
        try:
            compile_pql(source, request.user, slug, project_id=project_id)
        except WorkItemFilterError as exc:
            return Response({"valid": False, **exc.payload}, status=status.HTTP_200_OK)
        return Response({"valid": True, "expression": expression}, status=status.HTTP_200_OK)


class WorkItemQueryFieldsEndpoint(BaseAPIView):
    """The vocabulary of PQL, for the query bar's hints and completion."""

    @allow_permission(allowed_roles=[ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        fields = [
            {
                "name": name,
                "type": field.value_type,
                "lookups": sorted(field.lookups),
                "choices": sorted(field.choices) if field.choices else None,
                "aliases": sorted(alias for alias, target in FIELD_ALIASES.items() if target == name),
            }
            for name, field in FILTER_FIELDS.items()
        ]
        return Response(
            {
                "fields": fields,
                "unsupported": UNSUPPORTED_FIELDS,
                "functions": sorted(set(FUNCTIONS.values())),
                "custom_property_syntax": 'cf["<property id or name>"]',
            },
            status=status.HTTP_200_OK,
        )
