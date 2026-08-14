from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0140_issue_property_value_external_id"),
    ]

    operations = [
        migrations.AddField(
            model_name="issueactivity",
            name="external_source",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddField(
            model_name="issueactivity",
            name="external_id",
            field=models.CharField(blank=True, max_length=255, null=True),
        ),
        migrations.AddIndex(
            model_name="issueactivity",
            index=models.Index(
                fields=["project", "external_source", "external_id"],
                name="issue_act_ext_idx",
            ),
        ),
    ]
