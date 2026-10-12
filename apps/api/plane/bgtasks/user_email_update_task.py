# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import logging

# Third party imports
from celery import shared_task

# Django imports
from django.template.loader import render_to_string

# Module imports
from plane.utils.email import generate_plain_text_from_html
from plane.utils.email.transport import send_email
from plane.utils.exception_logger import log_exception


@shared_task
def send_email_update_magic_code(email, token):
    try:
        # Send the mail
        subject = "Verify your new email address"
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


@shared_task
def send_email_update_confirmation(email):
    """
    Send a confirmation email to the user after their email address has been successfully updated.

    Args:
        email: The new email address that was successfully updated
    """
    try:
        # Send the confirmation email
        subject = "Plane email address successfully updated"
        context = {"email": email}

        html_content = render_to_string("emails/user/email_updated.html", context)
        text_content = generate_plain_text_from_html(html_content)

        if send_email(
            subject=subject,
            to=[email],
            text_content=text_content,
            html_content=html_content,
        ):
            logging.getLogger("plane.worker").info(f"Email update confirmation sent successfully to {email}.")
        return
    except Exception as e:
        log_exception(e)
        return
