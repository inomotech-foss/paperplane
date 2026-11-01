# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.throttling import UserRateThrottle

from plane.utils.rate_limit import get_throttle_rate


class WritingAssistantThrottle(UserRateThrottle):
    scope = "writing_assistant"

    def get_rate(self):
        return get_throttle_rate(self.scope)
