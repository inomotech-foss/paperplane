# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Copy the service desk MS365 credentials to the shared MS365_* keys.

The old rows stay so pods of the previous release keep working during a
rollout. A later migration removes them together with ENABLE_SMTP.
"""

from django.db import migrations

COPIED_KEYS = {
    "SERVICE_DESK_MS365_TENANT_ID": "MS365_TENANT_ID",
    "SERVICE_DESK_MS365_CLIENT_ID": "MS365_CLIENT_ID",
    "SERVICE_DESK_MS365_CLIENT_SECRET": "MS365_CLIENT_SECRET",
}


def copy_ms365_credentials(apps, schema_editor):
    InstanceConfiguration = apps.get_model("license", "InstanceConfiguration")
    for old_key, new_key in COPIED_KEYS.items():
        old = InstanceConfiguration.objects.filter(key=old_key).first()
        if old is None or not old.value:
            continue
        new = InstanceConfiguration.objects.filter(key=new_key).first()
        if new is None:
            InstanceConfiguration.objects.create(
                key=new_key, value=old.value, category="MS365", is_encrypted=old.is_encrypted
            )
        elif not new.value:
            new.value = old.value
            new.is_encrypted = old.is_encrypted
            new.save(update_fields=["value", "is_encrypted"])


class Migration(migrations.Migration):
    dependencies = [
        ("license", "0006_instance_is_current_version_deprecated"),
    ]

    operations = [
        # The old rows are untouched, so going back needs no data change.
        migrations.RunPython(copy_ms365_credentials, migrations.RunPython.noop),
    ]
