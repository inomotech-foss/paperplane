# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Rename work item property types to the vocabulary Plane Cloud uses, so the
Plane SDK can read them.

NUMBER becomes DECIMAL and DATE becomes DATETIME. The two types that have no
cloud equivalent fold into a flag: MULTI_OPTION becomes OPTION with
`is_multi`, and USER becomes RELATION with `relation_type` set to USER. Only
`issue_properties` rows are touched; stored values keep their columns.
"""

from django.db import migrations

RENAMES = [("NUMBER", "DECIMAL"), ("DATE", "DATETIME")]


def to_cloud_names(apps, schema_editor):
    IssueProperty = apps.get_model("db", "IssueProperty")
    for old, new in RENAMES:
        IssueProperty.objects.filter(property_type=old).update(property_type=new)
    IssueProperty.objects.filter(property_type="MULTI_OPTION").update(property_type="OPTION", is_multi=True)
    IssueProperty.objects.filter(property_type="USER").update(property_type="RELATION", relation_type="USER")


def to_plane_names(apps, schema_editor):
    IssueProperty = apps.get_model("db", "IssueProperty")
    IssueProperty.objects.filter(property_type="RELATION", relation_type="USER").update(
        property_type="USER", relation_type=None
    )
    IssueProperty.objects.filter(property_type="OPTION", is_multi=True).update(
        property_type="MULTI_OPTION", is_multi=False
    )
    for old, new in RENAMES:
        IssueProperty.objects.filter(property_type=new).update(property_type=old)


class Migration(migrations.Migration):
    dependencies = [("db", "0138_work_item_property_types")]

    operations = [migrations.RunPython(to_cloud_names, to_plane_names)]
