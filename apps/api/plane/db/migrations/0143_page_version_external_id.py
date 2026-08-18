from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0142_project_issue_view"),
    ]

    operations = [
        migrations.AddField(
            model_name="pageversion",
            name="external_source",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="pageversion",
            name="external_id",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddIndex(
            model_name="pageversion",
            index=models.Index(
                fields=["page", "external_source", "external_id"],
                name="page_version_ext_idx",
            ),
        ),
    ]
