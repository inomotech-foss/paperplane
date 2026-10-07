# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from importlib import import_module

from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = "plane.api"

    def ready(self):
        # Registers the drf-spectacular authentication extensions.
        import_module("plane.utils.openapi.auth")
