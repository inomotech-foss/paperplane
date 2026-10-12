# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import logging

# Django imports
from django.template.loader import render_to_string

# Third party imports
from celery import shared_task

# Module imports
from plane.db.models import User
from plane.utils.email import generate_plain_text_from_html
from plane.utils.email.transport import send_email
from plane.utils.exception_logger import log_exception


@shared_task
def user_deactivation_email(current_site, user_id):
    try:
        # Send email to user when account is deactivated
        user = User.objects.get(id=user_id)
        subject = f"{user.first_name or user.display_name or user.email} has been deactivated on Plane"

        context = {"email": str(user.email), "login_url": current_site + "/login"}

        # Send email to user
        html_content = render_to_string("emails/user/user_deactivation.html", context)

        text_content = generate_plain_text_from_html(html_content)

        if send_email(
            subject=subject,
            to=[user.email],
            text_content=text_content,
            html_content=html_content,
        ):
            logging.getLogger("plane.worker").info("Email sent successfully.")
        return
    except Exception as e:
        log_exception(e)
        return
