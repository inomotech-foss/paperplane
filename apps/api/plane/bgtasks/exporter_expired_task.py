# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import boto3
from datetime import timedelta

# Django imports
from django.conf import settings
from django.utils import timezone
from django.db.models import Q

# Third party imports
from celery import shared_task
from botocore.client import Config

# Module imports
from plane.db.models import ExporterHistory


@shared_task
def delete_old_s3_link():
    # Get a list of keys and IDs to process
    expired_exporter_history = ExporterHistory.objects.filter(
        Q(url__isnull=False) & Q(created_at__lte=timezone.now() - timedelta(days=8))
    ).values_list("key", "id")
    s3 = boto3.client(
        "s3",
        endpoint_url=settings.AWS_S3_ENDPOINT_URL or None,
        region_name=settings.AWS_REGION or None,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        config=Config(signature_version="s3v4"),
    )

    for file_name, exporter_id in expired_exporter_history:
        # Delete object from S3
        if file_name:
            s3.delete_object(Bucket=settings.AWS_STORAGE_BUCKET_NAME, Key=file_name)

        ExporterHistory.objects.filter(id=exporter_id).update(url=None)
