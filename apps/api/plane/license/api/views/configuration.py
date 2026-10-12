# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from smtplib import (
    SMTPAuthenticationError,
    SMTPConnectError,
    SMTPRecipientsRefused,
    SMTPSenderRefused,
    SMTPServerDisconnected,
)

# Django imports
from django.core.mail import BadHeaderError
from django.db.models import Q, Case, When, Value

# Third party imports
import requests
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView
from plane.license.api.permissions import InstanceAdminPermission
from plane.license.models import InstanceConfiguration
from plane.license.api.serializers import InstanceConfigurationSerializer
from plane.license.utils.encryption import encrypt_data
from plane.utils.cache import cache_response, invalidate_cache
from plane.utils.rate_limit import invalidate_throttle_rates
from plane.license.utils.instance_value import get_managed_configuration_keys
from plane.utils.email.transport import SMTP, send_email
from plane.utils.exception_logger import log_exception
from plane.utils.ms365_graph import MSGraphAuthError, MSGraphError, MSGraphMessageTooLarge


class InstanceConfigurationEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    @cache_response(60 * 60 * 2, user=False)
    def get(self, request):
        instance_configurations = InstanceConfiguration.objects.all()
        serializer = InstanceConfigurationSerializer(instance_configurations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @invalidate_cache(path="/api/instances/configurations/", user=False)
    @invalidate_cache(path="/api/instances/", user=False)
    def patch(self, request):
        # Chart-managed keys are owned by the deploy; ignore attempts to edit
        # them here (they would be reverted on the next reconcile anyway).
        managed_keys = get_managed_configuration_keys()
        configurations = InstanceConfiguration.objects.filter(key__in=request.data.keys()).exclude(key__in=managed_keys)

        bulk_configurations = []
        for configuration in configurations:
            raw_value = request.data.get(configuration.key, configuration.value)
            value = "" if raw_value is None else str(raw_value).strip()
            if configuration.is_encrypted:
                configuration.value = encrypt_data(value)
            else:
                configuration.value = value
            bulk_configurations.append(configuration)

        InstanceConfiguration.objects.bulk_update(bulk_configurations, ["value"], batch_size=100)

        # Drop the cached throttle rates so edits apply on the next request.
        invalidate_throttle_rates()

        serializer = InstanceConfigurationSerializer(configurations, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class DisableEmailFeatureEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    @invalidate_cache(path="/api/instances/configurations/", user=False)
    @invalidate_cache(path="/api/instances/", user=False)
    def delete(self, request):
        try:
            # The MS365 credentials stay because the service desk shares them.
            InstanceConfiguration.objects.filter(
                Q(
                    key__in=[
                        "EMAIL_TRANSPORT",
                        "EMAIL_HOST",
                        "EMAIL_HOST_USER",
                        "EMAIL_HOST_PASSWORD",
                        "EMAIL_PORT",
                        "EMAIL_FROM",
                    ]
                )
            ).exclude(key__in=get_managed_configuration_keys()).update(
                value=Case(When(key="EMAIL_TRANSPORT", then=Value(SMTP)), default=Value(""))
            )
            return Response(status=status.HTTP_200_OK)
        except Exception:
            return Response(
                {"error": "Failed to disable email configuration"},
                status=status.HTTP_400_BAD_REQUEST,
            )


def graph_error_message(error):
    """A fixed message for the admin. The full Graph error goes to the server log."""
    if isinstance(error, MSGraphAuthError):
        return "Could not sign in to Microsoft 365. Check the tenant ID, client ID and client secret."
    if isinstance(error, MSGraphMessageTooLarge):
        return "The email is larger than the 4 MB Microsoft Graph limit."
    if error.status_code == 403:
        return "Microsoft Graph denied access. Check the Mail.Send permission and the mailbox access scope."
    if error.status_code == 404:
        return "Microsoft Graph did not find the sender mailbox. Check the sender's email address."
    if error.status_code in (429, 503, 504):
        return "Microsoft Graph is busy. Try again later."
    return "Microsoft Graph rejected the email. Check the server log for details."


class EmailCredentialCheckEndpoint(BaseAPIView):
    def post(self, request):
        receiver_email = request.data.get("receiver_email", False)
        if not receiver_email:
            return Response(
                {"error": "Receiver email is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        subject = "Email Notification from Plane"
        message = "This is a sample email notification sent from Plane application."
        try:
            sent = send_email(subject=subject, to=[receiver_email], text_content=message)
        except MSGraphError as e:
            log_exception(e)
            return Response({"error": graph_error_message(e)}, status=status.HTTP_400_BAD_REQUEST)
        except requests.RequestException:
            return Response(
                {"error": "Could not reach Microsoft Graph."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except BadHeaderError:
            return Response({"error": "Invalid email header."}, status=status.HTTP_400_BAD_REQUEST)
        except SMTPAuthenticationError:
            return Response(
                {"error": "Invalid credentials provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SMTPConnectError:
            return Response(
                {"error": "Could not connect with the SMTP server."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SMTPSenderRefused:
            return Response(
                {"error": "From address is invalid."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SMTPServerDisconnected:
            return Response(
                {"error": "SMTP server disconnected unexpectedly."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except SMTPRecipientsRefused:
            return Response(
                {"error": "All recipient addresses were refused."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except TimeoutError:
            return Response(
                {"error": "Timeout error while trying to connect to the SMTP server."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except ConnectionError:
            return Response(
                {"error": "Network connection error. Please check your internet connection."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response(
                {"error": "Could not send email. Please check your configuration"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not sent:
            return Response(
                {"error": "Email is not configured."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response({"message": "Email successfully sent."}, status=status.HTTP_200_OK)
