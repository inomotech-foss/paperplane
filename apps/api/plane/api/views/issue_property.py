# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import IntegrityError, transaction

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
)
from plane.utils.issue_property import (
    OPTION_PROPERTY_TYPES,
    build_value_maps,
    build_value_rows,
    filter_properties_by_issue_type,
    validate_value_payload,
    value_to_json,
)
from plane.utils.openapi import (
    issue_property_docs,
    FIELDS_PARAMETER,
    EXPAND_PARAMETER,
    INVALID_REQUEST_RESPONSE,
    DELETED_RESPONSE,
)
from .base import BaseAPIView


def project_issue_properties(slug, project_id, user):
    """Properties of a project the user is an active member of."""
    return (
        IssueProperty.objects.filter(workspace__slug=slug)
        .filter(project_id=project_id)
        .filter(
            project__project_projectmember__member=user,
            project__project_projectmember__is_active=True,
        )
        .filter(project__archived_at__isnull=True)
        .select_related("project")
        .select_related("workspace")
        .prefetch_related("options")
        .distinct()
    )


class IssuePropertyListCreateAPIEndpoint(BaseAPIView):
    """Issue Property List and Create Endpoint"""

    serializer_class = IssuePropertySerializer
    model = IssueProperty
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return project_issue_properties(self.kwargs.get("slug"), self.kwargs.get("project_id"), self.request.user)

    @issue_property_docs(
        operation_id="create_work_item_property",
        summary="Create work item property",
        description="Create a typed custom property (work item property) for a project. For OPTION properties, options can be created inline through the `options` field.",  # noqa: E501
        request=OpenApiRequest(request=IssuePropertySerializer),
        responses={
            201: OpenApiResponse(
                description="Work item property created",
                response=IssuePropertySerializer,
            ),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id, issue_type_id=None):
        """Create work item property

        Create a typed custom property for a project. Accepts an optional
        `options` list `[{name, sort_order?, is_default?}]` to create options
        inline for OPTION property types. Supports external ID
        tracking for integration purposes; a duplicate external id returns 409.

        Under a work item type the new property is scoped to that type,
        overriding any `issue_type` in the body.
        """
        data = request.data
        if issue_type_id is not None:
            data = {**data, "issue_type": str(issue_type_id)}
        options = data.get("options", [])
        property_type = data.get("property_type")

        if options and property_type not in OPTION_PROPERTY_TYPES:
            return Response(
                {"error": "Options can only be provided for OPTION properties"},
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
            serializer = IssuePropertySerializer(data=data, context={"project_id": project_id})
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
        operation_id="list_work_item_properties",
        summary="List work item properties",
        description="Retrieve all custom properties (work item properties) of a project.",
        parameters=[FIELDS_PARAMETER, EXPAND_PARAMETER],
        responses={
            200: OpenApiResponse(
                description="List of work item properties",
                response=IssuePropertySerializer(many=True),
            ),
        },
    )
    def get(self, request, slug, project_id, issue_type_id=None):
        """List work item properties

        Retrieve all custom properties of a project including their options.
        Under a work item type, or with `?issue_type=<uuid>`, returns the
        properties scoped to that type plus the unscoped (project-wide) ones.
        `?issue_type=null` (or `?unscoped=true`) returns only unscoped
        properties. With neither, every property of the project is returned.
        """
        queryset = self.get_queryset()
        if issue_type_id is not None:
            queryset, error = filter_properties_by_issue_type(queryset, issue_type_id)
        elif str(request.GET.get("unscoped", "")).lower() == "true":
            queryset, error = queryset.filter(issue_type__isnull=True), None
        else:
            queryset, error = filter_properties_by_issue_type(queryset, request.GET.get("issue_type"))
        if error is not None:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
        serializer = IssuePropertySerializer(queryset, many=True, fields=self.fields, expand=self.expand)
        return Response(serializer.data, status=status.HTTP_200_OK)


class IssuePropertyDetailAPIEndpoint(BaseAPIView):
    """Issue Property Detail Endpoint"""

    serializer_class = IssuePropertySerializer
    model = IssueProperty
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    def get_queryset(self):
        return project_issue_properties(self.kwargs.get("slug"), self.kwargs.get("project_id"), self.request.user)

    @issue_property_docs(
        operation_id="retrieve_work_item_property",
        summary="Retrieve work item property",
        description="Retrieve details of a specific work item property including its options.",
        responses={
            200: OpenApiResponse(
                description="Work item property retrieved",
                response=IssuePropertySerializer,
            ),
        },
    )
    def get(self, request, slug, project_id, property_id, issue_type_id=None):
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
        operation_id="update_work_item_property",
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
    def patch(self, request, slug, project_id, property_id, issue_type_id=None):
        """Update work item property

        Partially update a work item property (name, display name, activation,
        settings, ...). The property type cannot be changed once created.
        Validates external ID uniqueness if provided.
        """
        issue_property = IssueProperty.objects.get(workspace__slug=slug, project_id=project_id, pk=property_id)
        serializer = IssuePropertySerializer(
            issue_property, data=request.data, partial=True, context={"project_id": project_id}
        )
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
        operation_id="delete_work_item_property",
        summary="Delete work item property",
        description="Delete a work item property and its options and values.",
        responses={204: DELETED_RESPONSE},
    )
    def delete(self, request, slug, project_id, property_id, issue_type_id=None):
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
        operation_id="create_work_item_property_option",
        summary="Create work item property option",
        description="Create an option for an OPTION work item property.",
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

        Create an option for an OPTION work item property.
        Supports external ID tracking for integration purposes; a duplicate
        external id returns 409.
        """
        issue_property = IssueProperty.objects.get(workspace__slug=slug, project_id=project_id, pk=property_id)
        if issue_property.property_type not in OPTION_PROPERTY_TYPES:
            return Response(
                {"error": "Options can only be created for OPTION properties"},
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
        operation_id="list_work_item_property_options",
        summary="List work item property options",
        description="Retrieve all options of a work item property.",
        parameters=[FIELDS_PARAMETER, EXPAND_PARAMETER],
        responses={
            200: OpenApiResponse(
                description="List of work item property options",
                response=IssuePropertyOptionSerializer(many=True),
            ),
        },
    )
    def get(self, request, slug, project_id, property_id):
        """List work item property options

        Retrieve all options of a work item property.
        """
        serializer = IssuePropertyOptionSerializer(
            self.get_queryset(), many=True, fields=self.fields, expand=self.expand
        )
        return Response(serializer.data, status=status.HTTP_200_OK)


class IssuePropertyOptionDetailAPIEndpoint(BaseAPIView):
    """Issue Property Option Detail Endpoint"""

    serializer_class = IssuePropertyOptionSerializer
    model = IssuePropertyOption
    permission_classes = [ProjectEntityPermission]
    use_read_replica = True

    @issue_property_docs(
        operation_id="retrieve_work_item_property_option",
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
        operation_id="update_work_item_property_option",
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
        operation_id="delete_work_item_property_option",
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
        names in `display`. Multi-select values are lists.
        """
        # Ensure the work item exists in the project
        Issue.issue_objects.get(pk=work_item_id, project_id=project_id, workspace__slug=slug)
        values, display = build_value_maps(self.get_queryset())
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
        against the property type (DECIMAL must be numeric, OPTION accepts an
        option id or option name, a multi-select accepts a list, DATETIME accepts
        ISO 8601, BOOLEAN accepts booleans, USER accepts a workspace member
        id). Existing values of the listed properties are deleted and
        replaced; other properties are left untouched. `null` clears a
        property. Unknown property ids return 400.
        """
        issue = Issue.issue_objects.get(pk=work_item_id, project_id=project_id, workspace__slug=slug)
        properties, new_rows, error = validate_value_payload(issue, slug, project_id, request.data)
        if error is not None:
            return Response(error, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Replace semantics: drop existing values of the listed properties
            IssuePropertyValue.objects.filter(issue=issue, property_id__in=properties.keys()).delete(soft=False)
            IssuePropertyValue.objects.bulk_create(new_rows)

        values, display = build_value_maps(self.get_queryset())
        return Response({"values": values, "display": display}, status=status.HTTP_200_OK)


class IssuePropertySingleValueAPIEndpoint(BaseAPIView):
    """One property's value(s) on one work item.

    Addresses a single property, unlike IssuePropertyValueAPIEndpoint which
    reads and replaces a work item's values as a whole. A multi-select
    answers with a list, everything else with one object.
    """

    model = IssuePropertyValue
    permission_classes = [ProjectEntityPermission]

    def get_queryset(self):
        return (
            IssuePropertyValue.objects.filter(workspace__slug=self.kwargs.get("slug"))
            .filter(project_id=self.kwargs.get("project_id"))
            .filter(issue_id=self.kwargs.get("work_item_id"))
            .filter(property_id=self.kwargs.get("property_id"))
            .filter(
                project__project_projectmember__member=self.request.user,
                project__project_projectmember__is_active=True,
            )
            .select_related("property", "value_option", "value_user")
        )

    def serialize(self, rows, issue_property):
        payload = [
            {
                "id": str(row.id),
                "property_id": str(row.property_id),
                "issue_id": str(row.issue_id),
                "value": value_to_json(row)[0],
                "value_type": row.property.property_type,
                "external_id": row.external_id,
                "external_source": row.external_source,
            }
            for row in rows
        ]
        if issue_property.is_multi_option:
            return payload
        return payload[0] if payload else None

    def replace(self, request, slug, project_id, work_item_id, property_id):
        """Validate the body and swap in the new rows."""
        issue = Issue.issue_objects.get(pk=work_item_id, project_id=project_id, workspace__slug=slug)
        issue_property = IssueProperty.objects.get(pk=property_id, project_id=project_id, workspace__slug=slug)
        if "value" not in request.data:
            return None, Response({"error": "value is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            new_rows = build_value_rows(issue, issue_property, request.data.get("value"))
        except ValueError as error:
            return None, Response({"error": str(error)}, status=status.HTTP_400_BAD_REQUEST)

        for row in new_rows:
            row.external_id = request.data.get("external_id")
            row.external_source = request.data.get("external_source")

        with transaction.atomic():
            IssuePropertyValue.objects.filter(issue=issue, property_id=property_id).delete(soft=False)
            IssuePropertyValue.objects.bulk_create(new_rows)
        return issue_property, None

    @issue_property_docs(
        operation_id="retrieve_work_item_property_value",
        summary="Retrieve one work item property value",
        description="Retrieve the value(s) a work item holds for a single property.",
        responses={
            200: OpenApiResponse(description="Work item property value"),
            404: OpenApiResponse(description="The property has no value on this work item"),
        },
    )
    def get(self, request, slug, project_id, work_item_id, property_id):
        """Retrieve one work item property value

        A multi-select answers with a list, everything else with one object.
        Returns 404 when the property holds no value.
        """
        issue_property = IssueProperty.objects.get(pk=property_id, project_id=project_id, workspace__slug=slug)
        rows = list(self.get_queryset())
        if not rows:
            return Response({"error": "This property has no value on this work item"}, status=status.HTTP_404_NOT_FOUND)
        return Response(self.serialize(rows, issue_property), status=status.HTTP_200_OK)

    @issue_property_docs(
        operation_id="create_work_item_property_value",
        summary="Set one work item property value",
        description="Set the value(s) a work item holds for a single property, replacing whatever was there.",
        request=OpenApiRequest(request=None),
        responses={
            200: OpenApiResponse(description="Work item property value set"),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def post(self, request, slug, project_id, work_item_id, property_id):
        """Set one work item property value

        Body is `{"value": <scalar or list>}`. Whatever the property held is
        replaced, so this both creates and updates.
        """
        issue_property, error = self.replace(request, slug, project_id, work_item_id, property_id)
        if error is not None:
            return error
        return Response(self.serialize(list(self.get_queryset()), issue_property), status=status.HTTP_200_OK)

    @issue_property_docs(
        operation_id="update_work_item_property_value",
        summary="Update one work item property value",
        description="Replace the value(s) a work item holds for a single property.",
        request=OpenApiRequest(request=None),
        responses={
            200: OpenApiResponse(description="Work item property value updated"),
            400: INVALID_REQUEST_RESPONSE,
            404: OpenApiResponse(description="The property has no value on this work item"),
        },
    )
    def patch(self, request, slug, project_id, work_item_id, property_id):
        """Update one work item property value

        Like the POST, but refuses with 404 when the property holds no value
        yet.
        """
        if not self.get_queryset().exists():
            return Response({"error": "This property has no value on this work item"}, status=status.HTTP_404_NOT_FOUND)
        issue_property, error = self.replace(request, slug, project_id, work_item_id, property_id)
        if error is not None:
            return error
        return Response(self.serialize(list(self.get_queryset()), issue_property), status=status.HTTP_200_OK)

    @issue_property_docs(
        operation_id="delete_work_item_property_value",
        summary="Clear one work item property value",
        description="Remove the value(s) a work item holds for a single property.",
        responses={
            204: DELETED_RESPONSE,
            404: OpenApiResponse(description="The property has no value on this work item"),
        },
    )
    def delete(self, request, slug, project_id, work_item_id, property_id):
        """Clear one work item property value"""
        if not self.get_queryset().exists():
            return Response({"error": "This property has no value on this work item"}, status=status.HTTP_404_NOT_FOUND)
        self.get_queryset().delete(soft=False)
        return Response(status=status.HTTP_204_NO_CONTENT)
