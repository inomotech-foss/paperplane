# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import importlib
import inspect
import pkgutil

import pytest
from rest_framework import serializers

from plane.utils.audit_fields import AUDIT_FIELDS

PACKAGES = (
    "plane.app.serializers",
    "plane.api.serializers",
    "plane.license.api.serializers",
    "plane.space.serializer",
)


def _model_serializers() -> list[type[serializers.ModelSerializer]]:
    found: dict[str, type[serializers.ModelSerializer]] = {}
    for package in PACKAGES:
        root = importlib.import_module(package)
        for module in [
            root,
            *(importlib.import_module(f"{package}.{m.name}") for m in pkgutil.iter_modules(root.__path__)),
        ]:
            for _, cls in inspect.getmembers(module, inspect.isclass):
                meta = getattr(cls, "Meta", None)
                if issubclass(cls, serializers.ModelSerializer) and getattr(meta, "model", None):
                    found[f"{cls.__module__}.{cls.__qualname__}"] = cls
    return list(found.values())


@pytest.mark.unit
def test_no_serializer_takes_the_creator_or_updater_from_a_request():
    checked = 0
    writable = []
    for cls in _model_serializers():
        fields = cls().get_fields()
        checked += 1
        writable += [
            f"{cls.__module__}.{cls.__qualname__}.{name}"
            for name in AUDIT_FIELDS
            if name in fields and not fields[name].read_only
        ]

    assert checked > 100
    assert writable == []
