# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.core.management import BaseCommand, CommandError
from django.template.loader import render_to_string

# Module imports
from plane.utils.email import generate_plain_text_from_html
from plane.utils.email.transport import send_email


class Command(BaseCommand):
    """Send a test email through the configured transport"""

    def add_arguments(self, parser):
        # Positional argument
        parser.add_argument("to_email", type=str, help="receiver's email")

    def handle(self, *args, **options):
        receiver_email = options.get("to_email")

        if not receiver_email:
            raise CommandError("Receiver email is required")

        subject = "Test email from Plane"

        html_content = render_to_string("emails/test_email.html")
        text_content = generate_plain_text_from_html(html_content)

        self.stdout.write(self.style.SUCCESS("Trying to send test email..."))

        try:
            sent = send_email(
                subject=subject,
                to=[receiver_email],
                text_content=text_content,
                html_content=html_content,
            )
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error: Email could not be delivered due to {e}"))
            return
        if sent:
            self.stdout.write(self.style.SUCCESS("Email successfully sent"))
        else:
            self.stdout.write(self.style.ERROR("Error: Email is not configured"))
