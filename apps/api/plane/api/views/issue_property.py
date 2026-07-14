# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import uuid
from decimal import Decimal, InvalidOperation

# Django imports
from django.db import IntegrityError, transaction
from django.utils import timezone as django_timezone
from django.utils.dateparse import parse_date, parse_datetime

# Third party imports
from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiResponse, OpenApiRequest

# Module imports
from plane.api.serializers import (
    IssuePropertyOptionSerializer,
    IssuePropertySerializer,
)
from plane.app.permissions import ProjectEntityPermission
from plane.db.models import (
    Issue,
    IssueProperty,
    IssuePropertyOption,
    IssuePropertyValue,
    PropertyTypeChoices,
    WorkspaceMember,
)
from plane.utils.openapi import (
    issue_property_docs,
    CURSOR_PARAMETER,
    PER_PAGE_PARAMETER,
    FIELDS_PARAMETER,
    EXPAND_PARAMETER,
    create_paginated_response,
    INVALID_REQUEST_RESPONSE,
    DELETED_RESPONSE,
)
from .base import BaseAPIView


OPTION_PROPERTY_TYPES = [
    PropertyTypeChoices.OPTION,
    PropertyTypeChoices.MULTI_OPTION,
]

TRUE_VALUES = {"true", "1", "yes"}
FALSE_VALUES = {"false", "0", "no"}


def _parse_number(raw):
    """Parse a raw request value into a Decimal or raise ValueError."""
    if isinstance(raw, bool) or raw is None or isinstance(raw, (list, dict)):
        raise ValueError("Value must be numeric")
    try:
        return Decimal(str(raw))
    except InvalidOperation:
        raise ValueError("Value must be numeric")


def _parse_boolean(raw):
    """Parse a raw request value into a bool or raise ValueError."""
    if isinstance(raw, bool):
        return raw
    if isinstance(raw, str):
        if raw.lower() in TRUE_VALUES:
            return True
        if raw.lower() in FALSE_VALUES:
            return False
    raise ValueError("Value must be a boolean")


def _parse_datetime_value(raw):
    """Parse an ISO date or datetime string into an aware datetime or raise ValueError."""
    if not isinstance(raw, str):
        raise ValueError("Value must be an ISO 8601 date or datetime string")
    value = parse_datetime(raw)
    if value is None:
        date_value = parse_date(raw)
        if date_value is None:
            raise ValueError("Value must be an ISO 8601 date or datetime string")
        value = django_timezone.datetime.combine(date_value, django_timezone.datetime.min.time())
    if django_timezone.is_naive(value):
        value = django_timezone.make_aware(value, django_timezone.timezone.utc)
    return value


def _resolve_option(property_obj, raw):
    """Resolve a raw request value to an option of the property.

    Accepts an option id or an option name (names make imports pleasant),
    raises ValueError when the option does not exist on the property.
    """
    if isinstance(raw, (list, dict, bool)) or raw is None:
        raise ValueError("Value must be an option id or option name")
    raw = str(raw)
    try:
        option_id = uuid.UUID(raw)
        option = IssuePropertyOption.objects.filter(property=property_obj, id=option_id).first()
        if option is not None:
            return option
    except ValueError:
        # raw is not a UUID — fall through to lookup by option name
        pass
    option = IssuePropertyOption.objects.filter(property=property_obj, name=raw).first()
    if option is None:
        raise ValueError(f"Unknown option '{raw}' for property '{property_obj.name}'")
    return option


def _number_to_json(number):
    """Return a Decimal as an int when integral, else a float."""
    if number is None:
        return None
    if number == number.to_integral_value():
        return int(number)
    return float(number)


def build_issue_property_filters(query_params, slug, project_id):
    """Translate `property__<property_id>[__gt|__lt]` query params into ORM filters.

    Returns a tuple `(filters, error)` where `filters` is a list of filter
    kwargs dicts (one per query param, each targeting the `property_values`
    relation) and `error` is an error message or None.
    """
    parsed_params = []
    for key in query_params.keys():
        if not key.startswith("property__"):
            continue
        rest = key[len("property__") :]
        operator = "exact"
        for suffix, op in (("__gt", "gt"), ("__lt", "lt")):
            if rest.endswith(suffix):
                operator = op
                rest = rest[: -len(suffix)]
                break
        try:
            property_id = str(uuid.UUID(rest))
        except ValueError:
            return None, f"Invalid property filter '{key}'"
        parsed_params.append((key, property_id, operator, query_params.get(key)))

    if not parsed_params:
        return [], None

    properties = {
        str(prop.id): prop
        for prop in IssueProperty.objects.filter(
            workspace__slug=slug,
            project_id=project_id,
            id__in=[param[1] for param in parsed_params],
        )
    }

    filters = []
    for key, property_id, operator, raw in parsed_params:
        property_obj = properties.get(property_id)
        if property_obj is None:
            return None, f"Unknown property id '{property_id}'"

        filter_kwargs = {
            "property_values__property_id": property_id,
            "property_values__deleted_at__isnull": True,
        }
        try:
            if operator in ("gt", "lt"):
                if property_obj.property_type != PropertyTypeChoices.NUMBER:
                    return None, f"'__{operator}' filters are only supported for NUMBER properties"
                filter_kwargs[f"property_values__value_number__{operator}"] = _parse_number(raw)
            elif property_obj.property_type == PropertyTypeChoices.NUMBER:
                filter_kwargs["property_values__value_number"] = _parse_number(raw)
            elif property_obj.property_type in OPTION_PROPERTY_TYPES:
                filter_kwargs["property_values__value_option_id"] = _resolve_option(property_obj, raw).id
            elif property_obj.property_type == PropertyTypeChoices.BOOLEAN:
                filter_kwargs["property_values__value_boolean"] = _parse_boolean(raw)
            elif property_obj.property_type == PropertyTypeChoices.DATE:
                filter_kwargs["property_values__value_date"] = _parse_datetime_value(raw)
            elif property_obj.property_type == PropertyTypeChoices.USER:
                filter_kwargs["property_values__value_user_id"] = str(uuid.UUID(str(raw)))
            else:
                filter_kwargs["property_values__value_text"] = raw
        except ValueError:
            return None, (
                f"Invalid value for filter '{key}': expected a value matching the "
                f"property type '{property_obj.property_type}'"
            )
        filters.append(filter_kwargs)
    return filters, None


class IssuePropertyListCreateAPIEndpoint(BaseAPIView):
    """Issue Property List and Create Endpoint"""

    serializer_class = IssuePropertySerializer
    model = IssueProperty
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssueProperty.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(project__archived_at__isnull=True)
            .select_related("project")
            .select_related("workspace")
            .prefetch_related("options")
            .distinct()
        )

    @issue_property_docs(
        operation_id="create_issue_property",
        summary="Create work item property",
        description="Create a typed custom property (work item property) for a project. For OPTION and MULTI_OPTION properties, options can be created inline through the `options` field.",  # noqa: E501
        request=OpenApiRequest(request=IssuePropertySerializer),
        responses={
            201: OpenApiResponse(
                description="Work item property created",
                response=IssuePropertySerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id):
        """Create work item property

        Create a typed custom property for a project. Accepts an optional
        `options` list `[{name, sort_order?, is_default?}]` to create options
        inline for OPTION / MULTI_OPTION property types. Supports external ID
        tracking for integration purposes; a duplicate external id returns 409.
        """
        options = request.data.get("options", [])
        property_type = request.data.get("property_type")

        if options and property_type not in OPTION_PROPERTY_TYPES:
            return Response(
                {"error": "Options can only be provided for OPTION or MULTI_OPTION properties"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if options and (
            not isinstance(options, list)
            or any(not isinstance(option, dict) or not option.get("name") for option in options)
        ):
            return Response(
                {"error": "options must be a list of objects with a name"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            serializer = IssuePropertySerializer(data=request.data)
            if serializer.is_valid():
                if (
                    request.data.get("external_id")
                    and request.data.get("external_source")
                    and IssueProperty.objects.filter(
                        project_id=project_id,
                        workspace__slug=slug,
                        external_source=request.data.get("external_source"),
                        external_id=request.data.get("external_id"),
                    ).exists()
                ):
                    issue_property = IssueProperty.objects.filter(
                        workspace__slug=slug,
                        project_id=project_id,
                        external_source=request.data.get("external_source"),
                        external_id=request.data.get("external_id"),
                    ).first()
                    return Response(
                        {
                            "error": "Work item property with the same external id and external source already exists",
                            "id": str(issue_property.id),
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                with transaction.atomic():
                    issue_property = serializer.save(project_id=project_id)
                    for option in options:
                        option_serializer = IssuePropertyOptionSerializer(data=option)
                        option_serializer.is_valid(raise_exception=True)
                        option_serializer.save(property=issue_property, project_id=project_id)

                issue_property = self.get_queryset().get(pk=issue_property.id)
                return Response(
                    IssuePropertySerializer(issue_property).data,
                    status=status.HTTP_201_CREATED,
                )
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            issue_property = IssueProperty.objects.filter(
                workspace__slug=slug,
                project_id=project_id,
                name=request.data.get("name"),
            ).first()
            return Response(
                {
                    "error": "Work item property with the same name already exists in the project",
                    "id": str(issue_property.id) if issue_property else None,
                },
                status=status.HTTP_409_CONFLICT,
            )

    @issue_property_docs(
        operation_id="list_issue_properties",
        summary="List work item properties",
        description="Retrieve all custom properties (work item properties) of a project.",
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                IssuePropertySerializer,
                "PaginatedIssuePropertyResponse",
                "Paginated list of work item properties",
                "Paginated Work Item Properties",
            ),
        },
    )
    def get(self, request, slug, project_id):
        """List work item properties

        Retrieve all custom properties of a project including their options.
        Returns paginated results.
        """
        return self.paginate(
            request=request,
            queryset=(self.get_queryset()),
            on_results=lambda issue_properties: IssuePropertySerializer(
                issue_properties, many=True, fields=self.fields, expand=self.expand
            ).data,
        )


class IssuePropertyDetailAPIEndpoint(BaseAPIView):
    """Issue Property Detail Endpoint"""

    serializer_class = IssuePropertySerializer
    model = IssueProperty
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssueProperty.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(project__archived_at__isnull=True)
            .select_related("project")
            .select_related("workspace")
            .prefetch_related("options")
            .distinct()
        )

    @issue_property_docs(
        operation_id="retrieve_issue_property",
        summary="Retrieve work item property",
        description="Retrieve details of a specific work item property including its options.",
        responses={
            200: OpenApiResponse(
                description="Work item property retrieved",
                response=IssuePropertySerializer,
            ),
        },
    )
    def get(self, request, slug, project_id, property_id):
        """Retrieve work item property

        Retrieve details of a specific work item property including its options.
        """
        serializer = IssuePropertySerializer(
            self.get_queryset().get(pk=property_id),
            fields=self.fields,
            expand=self.expand,
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

    @issue_property_docs(
        operation_id="update_issue_property",
        summary="Update work item property",
        description="Partially update a work item property. The property type cannot be changed once created.",
        request=OpenApiRequest(request=IssuePropertySerializer),
        responses={
            200: OpenApiResponse(
                description="Work item property updated",
                response=IssuePropertySerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id, property_id):
        """Update work item property

        Partially update a work item property (name, display name, activation,
        settings, ...). The property type cannot be changed once created.
        Validates external ID uniqueness if provided.
        """
        issue_property = IssueProperty.objects.get(workspace__slug=slug, project_id=project_id, pk=property_id)
        serializer = IssuePropertySerializer(issue_property, data=request.data, partial=True)
        if serializer.is_valid():
            if (
                request.data.get("external_id")
                and (issue_property.external_id != str(request.data.get("external_id")))
                and IssueProperty.objects.filter(
                    project_id=project_id,
                    workspace__slug=slug,
                    external_source=request.data.get("external_source", issue_property.external_source),
                    external_id=request.data.get("external_id"),
                ).exists()
            ):
                return Response(
                    {
                        "error": "Work item property with the same external id and external source already exists",
                        "id": str(issue_property.id),
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @issue_property_docs(
        operation_id="delete_issue_property",
        summary="Delete work item property",
        description="Delete a work item property and its options and values.",
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, property_id):
        """Delete work item property

        Delete a work item property. Its options and stored values are
        removed along with it.
        """
        issue_property = IssueProperty.objects.get(workspace__slug=slug, project_id=project_id, pk=property_id)
        issue_property.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssuePropertyOptionListCreateAPIEndpoint(BaseAPIView):
    """Issue Property Option List and Create Endpoint"""

    serializer_class = IssuePropertyOptionSerializer
    model = IssuePropertyOption
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return (
            IssuePropertyOption.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(property_id=self.kwargs.get("property_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .filter(project__archived_at__isnull=True)
            .select_related("project")
            .select_related("workspace")
            .distinct()
        )

    @issue_property_docs(
        operation_id="create_issue_property_option",
        summary="Create work item property option",
        description="Create an option for an OPTION or MULTI_OPTION work item property.",
        request=OpenApiRequest(request=IssuePropertyOptionSerializer),
        responses={
            201: OpenApiResponse(
                description="Work item property option created",
                response=IssuePropertyOptionSerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id, property_id):
        """Create work item property option

        Create an option for an OPTION or MULTI_OPTION work item property.
        Supports external ID tracking for integration purposes; a duplicate
        external id returns 409.
        """
        issue_property = IssueProperty.objects.get(workspace__slug=slug, project_id=project_id, pk=property_id)
        if issue_property.property_type not in OPTION_PROPERTY_TYPES:
            return Response(
                {"error": "Options can only be created for OPTION or MULTI_OPTION properties"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            serializer = IssuePropertyOptionSerializer(data=request.data)
            if serializer.is_valid():
                if (
                    request.data.get("external_id")
                    and request.data.get("external_source")
                    and IssuePropertyOption.objects.filter(
                        property_id=property_id,
                        external_source=request.data.get("external_source"),
                        external_id=request.data.get("external_id"),
                    ).exists()
                ):
                    option = IssuePropertyOption.objects.filter(
                        property_id=property_id,
                        external_source=request.data.get("external_source"),
                        external_id=request.data.get("external_id"),
                    ).first()
                    return Response(
                        {
                            "error": "Work item property option with the same external id and external source already exists",  # noqa: E501
                            "id": str(option.id),
                        },
                        status=status.HTTP_409_CONFLICT,
                    )
                serializer.save(property=issue_property, project_id=project_id)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError:
            option = IssuePropertyOption.objects.filter(
                property_id=property_id,
                name=request.data.get("name"),
            ).first()
            return Response(
                {
                    "error": "Work item property option with the same name already exists",
                    "id": str(option.id) if option else None,
                },
                status=status.HTTP_409_CONFLICT,
            )

    @issue_property_docs(
        operation_id="list_issue_property_options",
        summary="List work item property options",
        description="Retrieve all options of a work item property.",
        parameters=[
            CURSOR_PARAMETER,
            PER_PAGE_PARAMETER,
            FIELDS_PARAMETER,
            EXPAND_PARAMETER,
        ],
        responses={
            200: create_paginated_response(
                IssuePropertyOptionSerializer,
                "PaginatedIssuePropertyOptionResponse",
                "Paginated list of work item property options",
                "Paginated Work Item Property Options",
            ),
        },
    )
    def get(self, request, slug, project_id, property_id):
        """List work item property options

        Retrieve all options of a work item property. Returns paginated results.
        """
        return self.paginate(
            request=request,
            queryset=(self.get_queryset()),
            on_results=lambda options: IssuePropertyOptionSerializer(
                options, many=True, fields=self.fields, expand=self.expand
            ).data,
        )


class IssuePropertyOptionDetailAPIEndpoint(BaseAPIView):
    """Issue Property Option Detail Endpoint"""

    serializer_class = IssuePropertyOptionSerializer
    model = IssuePropertyOption
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    @issue_property_docs(
        operation_id="retrieve_issue_property_option",
        summary="Retrieve work item property option",
        description="Retrieve details of a specific work item property option.",
        responses={
            200: OpenApiResponse(
                description="Work item property option retrieved",
                response=IssuePropertyOptionSerializer,
            ),
        },
    )
    def get(self, request, slug, project_id, property_id, option_id):
        """Retrieve work item property option

        Retrieve details of a specific work item property option.
        """
        option = IssuePropertyOption.objects.get(
            workspace__slug=slug,
            project_id=project_id,
            property_id=property_id,
            pk=option_id,
        )
        serializer = IssuePropertyOptionSerializer(option, fields=self.fields, expand=self.expand)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @issue_property_docs(
        operation_id="update_issue_property_option",
        summary="Update work item property option",
        description="Partially update a work item property option.",
        request=OpenApiRequest(request=IssuePropertyOptionSerializer),
        responses={
            200: OpenApiResponse(
                description="Work item property option updated",
                response=IssuePropertyOptionSerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id, property_id, option_id):
        """Update work item property option

        Partially update a work item property option (name, sort order,
        default flag). Validates external ID uniqueness if provided.
        """
        option = IssuePropertyOption.objects.get(
            workspace__slug=slug,
            project_id=project_id,
            property_id=property_id,
            pk=option_id,
        )
        serializer = IssuePropertyOptionSerializer(option, data=request.data, partial=True)
        if serializer.is_valid():
            if (
                request.data.get("external_id")
                and (option.external_id != str(request.data.get("external_id")))
                and IssuePropertyOption.objects.filter(
                    property_id=property_id,
                    external_source=request.data.get("external_source", option.external_source),
                    external_id=request.data.get("external_id"),
                ).exists()
            ):
                return Response(
                    {
                        "error": "Work item property option with the same external id and external source already exists",  # noqa: E501
                        "id": str(option.id),
                    },
                    status=status.HTTP_409_CONFLICT,
                )
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @issue_property_docs(
        operation_id="delete_issue_property_option",
        summary="Delete work item property option",
        description="Delete a work item property option.",
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, property_id, option_id):
        """Delete work item property option

        Delete a work item property option.
        """
        option = IssuePropertyOption.objects.get(
            workspace__slug=slug,
            project_id=project_id,
            property_id=property_id,
            pk=option_id,
        )
        option.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class IssuePropertyValueAPIEndpoint(BaseAPIView):
    """Work Item Property Values Endpoint

    GET returns the property values of a work item as a
    `{property_id: value(s)}` map (plus a `display` map with human readable
    values). PUT bulk-replaces the values of the listed properties.
    """

    model = IssuePropertyValue
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            IssuePropertyValue.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("work_item_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .select_related("property", "value_option", "value_user")
        )

    def _build_value_maps(self):
        """Build the `{property_id: value(s)}` and display maps for the work item."""
        values = {}
        display = {}
        for value in self.get_queryset():
            property_id = str(value.property_id)
            property_type = value.property.property_type
            if property_type == PropertyTypeChoices.MULTI_OPTION:
                values.setdefault(property_id, [])
                display.setdefault(property_id, [])
                if value.value_option_id:
                    values[property_id].append(str(value.value_option_id))
                    display[property_id].append(value.value_option.name)
            elif property_type == PropertyTypeChoices.OPTION:
                values[property_id] = str(value.value_option_id) if value.value_option_id else None
                display[property_id] = value.value_option.name if value.value_option_id else None
            elif property_type == PropertyTypeChoices.NUMBER:
                values[property_id] = _number_to_json(value.value_number)
                display[property_id] = values[property_id]
            elif property_type == PropertyTypeChoices.DATE:
                values[property_id] = value.value_date.isoformat() if value.value_date else None
                display[property_id] = values[property_id]
            elif property_type == PropertyTypeChoices.BOOLEAN:
                values[property_id] = value.value_boolean
                display[property_id] = value.value_boolean
            elif property_type == PropertyTypeChoices.USER:
                values[property_id] = str(value.value_user_id) if value.value_user_id else None
                display[property_id] = value.value_user.display_name if value.value_user_id else None
            else:
                values[property_id] = value.value_text
                display[property_id] = value.value_text
        return values, display

    def _build_rows(self, issue, property_obj, raw):
        """Validate a raw request value against the property type and return
        the IssuePropertyValue rows to insert. Raises ValueError on invalid values."""
        base = {
            "issue": issue,
            "property": property_obj,
            "workspace_id": issue.workspace_id,
            "project_id": issue.project_id,
        }
        # None (or an empty list) clears the property values
        if raw is None or raw == [] or raw == "":
            return []

        property_type = property_obj.property_type
        if property_type == PropertyTypeChoices.MULTI_OPTION:
            raw_values = raw if isinstance(raw, list) else [raw]
            options = []
            for raw_value in raw_values:
                option = _resolve_option(property_obj, raw_value)
                if option not in options:
                    options.append(option)
            return [IssuePropertyValue(**base, value_option=option) for option in options]

        if isinstance(raw, list):
            raise ValueError("A list of values is only allowed for MULTI_OPTION properties")

        if property_type == PropertyTypeChoices.OPTION:
            return [IssuePropertyValue(**base, value_option=_resolve_option(property_obj, raw))]
        if property_type == PropertyTypeChoices.NUMBER:
            return [IssuePropertyValue(**base, value_number=_parse_number(raw))]
        if property_type == PropertyTypeChoices.DATE:
            return [IssuePropertyValue(**base, value_date=_parse_datetime_value(raw))]
        if property_type == PropertyTypeChoices.BOOLEAN:
            return [IssuePropertyValue(**base, value_boolean=_parse_boolean(raw))]
        if property_type == PropertyTypeChoices.USER:
            try:
                user_id = uuid.UUID(str(raw))
            except ValueError:
                raise ValueError("Value must be a user id")
            if not WorkspaceMember.objects.filter(
                workspace_id=issue.workspace_id, member_id=user_id, is_active=True
            ).exists():
                raise ValueError(f"Unknown user '{raw}' in this workspace")
            return [IssuePropertyValue(**base, value_user_id=user_id)]
        # TEXT
        if isinstance(raw, dict):
            raise ValueError("Value must be a string")
        return [IssuePropertyValue(**base, value_text=str(raw))]

    @issue_property_docs(
        operation_id="retrieve_work_item_property_values",
        summary="Retrieve work item property values",
        description="Retrieve the custom property values of a work item as a `{property_id: value(s)}` map.",
        responses={
            200: OpenApiResponse(description="Work item property values"),
        },
    )
    def get(self, request, slug, project_id, work_item_id):
        """Retrieve work item property values

        Returns `{"values": {property_id: value(s)}, "display": {property_id: display}}`.
        Option values are returned as option ids in `values` and as option
        names in `display`. MULTI_OPTION values are lists.
        """
        # Ensure the work item exists in the project
        Issue.issue_objects.get(pk=work_item_id, project_id=project_id, workspace__slug=slug)
        values, display = self._build_value_maps()
        return Response({"values": values, "display": display}, status=status.HTTP_200_OK)

    @issue_property_docs(
        operation_id="update_work_item_property_values",
        summary="Bulk replace work item property values",
        description="Bulk replace the custom property values of a work item. Body is a `{property_id: value(s)}` map; existing values of the listed properties are replaced.",  # noqa: E501
        request=OpenApiRequest(request=None),
        responses={
            200: OpenApiResponse(description="Work item property values updated"),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def put(self, request, slug, project_id, work_item_id):
        """Bulk replace work item property values

        Body: `{"<property_id>": <scalar or list>}`. Values are validated
        against the property type (NUMBER must be numeric, OPTION accepts an
        option id or option name, MULTI_OPTION accepts a list, DATE accepts
        ISO 8601, BOOLEAN accepts booleans, USER accepts a workspace member
        id). Existing values of the listed properties are deleted and
        replaced; other properties are left untouched. `null` clears a
        property. Unknown property ids return 400.
        """
        issue = Issue.issue_objects.get(pk=work_item_id, project_id=project_id, workspace__slug=slug)
        data = request.data
        if not isinstance(data, dict) or not data:
            return Response(
                {"error": "Expected a non-empty mapping of property id to value"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        property_ids = []
        for key in data.keys():
            try:
                property_ids.append(str(uuid.UUID(str(key))))
            except ValueError:
                return Response(
                    {"error": f"Invalid property id '{key}'"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        properties = {
            str(prop.id): prop
            for prop in IssueProperty.objects.filter(
                workspace__slug=slug, project_id=project_id, id__in=property_ids
            )
        }
        unknown = [key for key in data.keys() if str(uuid.UUID(str(key))) not in properties]
        if unknown:
            return Response(
                {"error": f"Unknown property id(s): {', '.join(unknown)}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_rows = []
        errors = {}
        for key, raw in data.items():
            property_obj = properties[str(uuid.UUID(str(key)))]
            try:
                new_rows.extend(self._build_rows(issue, property_obj, raw))
            except ValueError as e:
                errors[str(key)] = str(e)
        if errors:
            return Response(
                {"error": "Invalid property values", "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            # Replace semantics: drop existing values of the listed properties
            IssuePropertyValue.objects.filter(issue=issue, property_id__in=properties.keys()).delete(soft=False)
            IssuePropertyValue.objects.bulk_create(new_rows)

        values, display = self._build_value_maps()
        return Response({"values": values, "display": display}, status=status.HTTP_200_OK)
