# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.app.serializers import TrashedIssueSerializer


class DeletedWorkItemSerializer(TrashedIssueSerializer):
    """A deleted work item that can still be restored."""
