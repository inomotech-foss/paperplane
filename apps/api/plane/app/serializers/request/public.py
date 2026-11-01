# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers

from plane.db.models import IssueVote


class PublicVoteSerializer(serializers.Serializer):
    vote = serializers.ChoiceField(
        choices=IssueVote._meta.get_field("vote").choices, required=False, help_text="1 when omitted"
    )
