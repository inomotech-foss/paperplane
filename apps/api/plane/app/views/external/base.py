# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python import
import os

# Third party import
import requests
from urllib.parse import quote

from rest_framework import status
from rest_framework.response import Response
from drf_spectacular.utils import OpenApiResponse, extend_schema
from drf_spectacular.types import OpenApiTypes

# Module import
from plane.app.serializers.request.asset import UNSPLASH_PARAMETERS
from plane.license.utils.instance_value import get_configuration_value

from ..base import BaseAPIView


class UnsplashEndpoint(BaseAPIView):
    @extend_schema(
        parameters=UNSPLASH_PARAMETERS,
        responses={200: OpenApiResponse(OpenApiTypes.ANY, description="The Unsplash API response, passed through")},
    )
    def get(self, request):
        (UNSPLASH_ACCESS_KEY,) = get_configuration_value(
            [
                {
                    "key": "UNSPLASH_ACCESS_KEY",
                    "default": os.environ.get("UNSPLASH_ACCESS_KEY"),
                }
            ]
        )
        # Check unsplash access key
        if not UNSPLASH_ACCESS_KEY:
            return Response([], status=status.HTTP_200_OK)

        # Query parameters
        query = request.GET.get("query", False)
        page = request.GET.get("page", 1)
        per_page = request.GET.get("per_page", 20)

        url = (
            f"https://api.unsplash.com/search/photos/?client_id={UNSPLASH_ACCESS_KEY}&query={quote(query)}&page={page}&per_page={per_page}"
            if query
            else f"https://api.unsplash.com/photos/?client_id={UNSPLASH_ACCESS_KEY}&page={page}&per_page={per_page}"
        )

        headers = {"Content-Type": "application/json"}

        resp = requests.get(url=url, headers=headers)
        return Response(resp.json(), status=resp.status_code)
