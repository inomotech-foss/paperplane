# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.throttling import AnonRateThrottle

from plane.utils.rate_limit import get_throttle_rate


class ConfigurableAnonRateThrottle(AnonRateThrottle):
    """Default throttle for anonymous requests, with its rate read from instance
    config (scope "anon") instead of DEFAULT_THROTTLE_RATES."""

    def get_rate(self):
        return get_throttle_rate(self.scope)
