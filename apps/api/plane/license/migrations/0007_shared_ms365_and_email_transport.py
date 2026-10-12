# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Move the service desk MS365 credentials to the shared MS365_* keys and drop ENABLE_SMTP."""

from django.db import migrations

RENAMED_KEYS = {
    "SERVICE_DESK_MS365_TENANT_ID": "MS365_TENANT_ID",
    "SERVICE_DESK_MS365_CLIENT_ID": "MS365_CLIENT_ID",
    "SERVICE_DESK_MS365_CLIENT_SECRET": "MS365_CLIENT_SECRET",
}


def share_ms365_credentials(apps, schema_editor):
    InstanceConfiguration = apps.get_model("license", "InstanceConfiguration")
    for old_key, new_key in RENAMED_KEYS.items():
        old = InstanceConfiguration.objects.filter(key=old_key).first()
        if old is None:
            continue
        new = InstanceConfiguration.objects.filter(key=new_key).first()
        if new is None:
            old.key = new_key
            old.category = "MS365"
            old.save(update_fields=["key", "category"])
            continue
        if not new.value and old.value:
            new.value = old.value
            new.is_encrypted = old.is_encrypted
            new.save(update_fields=["value", "is_encrypted"])
        old.delete()
    InstanceConfiguration.objects.filter(key="ENABLE_SMTP").delete()


def restore_service_desk_keys(apps, schema_editor):
    InstanceConfiguration = apps.get_model("license", "InstanceConfiguration")
    for old_key, new_key in RENAMED_KEYS.items():
        InstanceConfiguration.objects.filter(key=new_key).update(key=old_key, category="SERVICE_DESK")


class Migration(migrations.Migration):
    dependencies = [
        ("license", "0006_instance_is_current_version_deprecated"),
    ]

    operations = [
        migrations.RunPython(share_ms365_credentials, restore_service_desk_keys),
    ]
