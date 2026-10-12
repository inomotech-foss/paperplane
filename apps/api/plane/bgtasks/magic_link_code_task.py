# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import logging

# Third party imports
from celery import shared_task

# Django imports
# Third party imports
from django.template.loader import render_to_string

# Module imports
from plane.utils.email import generate_plain_text_from_html
from plane.utils.email.transport import send_email
from plane.utils.exception_logger import log_exception


@shared_task
def magic_link(email, key, token):
    try:
        # Send the mail
        subject = f"Your unique Plane login code is {token}"
        context = {"code": token, "email": email}

        html_content = render_to_string("emails/auth/magic_signin.html", context)
        text_content = generate_plain_text_from_html(html_content)

        if send_email(
            subject=subject,
            to=[email],
            text_content=text_content,
            html_content=html_content,
        ):
            logging.getLogger("plane.worker").info("Email sent successfully.")
        return
    except Exception as e:
        log_exception(e)
        return
