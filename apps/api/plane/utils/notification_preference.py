# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.db.models import User, UserNotificationPreference

ALL_OFF = {
    "property_change": False,
    "state_change": False,
    "comment": False,
    "mention": False,
    "issue_completed": False,
}


def notification_preferences(user_ids):
    """Each user's preference by id. A missing row means all on, or all off for bots."""
    user_ids = [str(user_id) for user_id in user_ids]
    rows = {
        str(preference.user_id): preference
        for preference in UserNotificationPreference.objects.filter(user_id__in=user_ids)
    }
    bots = {str(user_id) for user_id in User.objects.filter(pk__in=user_ids, is_bot=True).values_list("id", flat=True)}
    return {
        user_id: rows.get(user_id)
        or UserNotificationPreference(user_id=user_id, **(ALL_OFF if user_id in bots else {}))
        for user_id in user_ids
    }


def notification_preference(user_id):
    return notification_preferences([user_id])[str(user_id)]
