# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0152_subscribe_assignees"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="issuetype",
            name="is_epic",
        ),
    ]
