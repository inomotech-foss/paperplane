# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from importlib import import_module

import pytest
from django.conf import settings


@pytest.mark.unit
@pytest.mark.parametrize("module", settings.CELERY_IMPORTS)
def test_celery_import_loads(module):
    import_module(module)
