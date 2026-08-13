# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from drf_spectacular.utils import OpenApiRequest, OpenApiResponse
from rest_framework import status
from rest_framework.response import Response

from plane.app.permissions import ProjectEntityPermission
from plane.db.models import Project
from plane.utils.openapi import INVALID_REQUEST_RESPONSE, project_docs

from .base import BaseAPIView

# The feature names Plane Cloud uses, mapped to the columns we keep them in.
# Cloud has more features than we do; the ones with no column are left out
# rather than reported as off.
FEATURE_FIELDS = {
    "modules": "module_view",
    "cycles": "cycle_view",
    "views": "issue_views_view",
    "pages": "page_view",
    "intakes": "intake_view",
    "work_item_types": "is_issue_type_enabled",
}


class ProjectFeatureAPIEndpoint(BaseAPIView):
    """Which features a project has switched on."""

    model = Project
    permission_classes = [ProjectEntityPermission]

    def features(self, project):
        return {name: getattr(project, field) for name, field in FEATURE_FIELDS.items()}

    @project_docs(
        operation_id="retrieve_project_features",
        summary="Retrieve project features",
        description="Retrieve which features a project has switched on.",
        responses={200: OpenApiResponse(description="Project features")},
    )
    def get(self, request, slug, project_id):
        """Retrieve project features"""
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        return Response(self.features(project), status=status.HTTP_200_OK)

    @project_docs(
        operation_id="update_project_features",
        summary="Update project features",
        description="Switch project features on or off. Only the features named in the body change.",
        request=OpenApiRequest(request=None),
        responses={
            200: OpenApiResponse(description="Project features updated"),
            400: INVALID_REQUEST_RESPONSE,
        },
    )
    def patch(self, request, slug, project_id):
        """Update project features

        Body is `{"cycles": true, ...}`. Features we do not have are refused
        rather than silently ignored.
        """
        unknown = [name for name in request.data if name not in FEATURE_FIELDS]
        if unknown:
            return Response(
                {"error": f"Unknown feature(s): {', '.join(sorted(unknown))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        not_boolean = [name for name, value in request.data.items() if not isinstance(value, bool)]
        if not_boolean:
            return Response(
                {"error": f"Feature(s) must be true or false: {', '.join(sorted(not_boolean))}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        for name, value in request.data.items():
            setattr(project, FEATURE_FIELDS[name], value)
        project.save(update_fields=[FEATURE_FIELDS[name] for name in request.data])
        return Response(self.features(project), status=status.HTTP_200_OK)
