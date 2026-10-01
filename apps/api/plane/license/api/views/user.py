# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db.models import Count, Exists, OuterRef, Q
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from plane.authentication.utils.host import base_host
from plane.db.models import User, Workspace, WorkspaceMember
from plane.license.api.permissions import InstanceAdminPermission
from plane.license.models import INSTANCE_ADMIN_MIN_ROLE, InstanceAdmin
from plane.license.utils.user_lifecycle import (
    UserLifecycleError,
    deactivate_user,
    reactivate_user,
    soft_delete_user,
)
from plane.license.utils.user_merge import MergeError, merge_users

from .base import BaseAPIView

TRUE_VALUES = ("1", "true", "yes")
FALSE_VALUES = ("0", "false", "no")


def parse_bool(value):
    if value is None:
        return None
    value = str(value).lower()
    if value in TRUE_VALUES:
        return True
    if value in FALSE_VALUES:
        return False
    return None


def annotated_users():
    is_admin = InstanceAdmin.objects.filter(user=OuterRef("pk"), role__gte=INSTANCE_ADMIN_MIN_ROLE)
    return User.objects.annotate(
        workspace_count=Count(
            "member_workspace",
            filter=Q(member_workspace__is_active=True, member_workspace__deleted_at__isnull=True),
            distinct=True,
        ),
        is_instance_admin=Exists(is_admin),
    ).prefetch_related("accounts")


def serialize_user(user):
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "avatar_url": user.avatar_url,
        "is_active": user.is_active,
        "is_bot": user.is_bot,
        "deleted_at": user.deleted_at,
        "merged_into": str(user.merged_into_id) if user.merged_into_id else None,
        "is_instance_admin": user.is_instance_admin,
        "providers": sorted({account.provider for account in user.accounts.all()}),
        "workspace_count": user.workspace_count,
        "last_login_time": user.last_login_time,
        "date_joined": user.date_joined,
    }


def serialize_user_detail(user):
    memberships = WorkspaceMember.objects.filter(member=user).select_related("workspace").order_by("workspace__slug")
    owned = Workspace.objects.filter(owner=user).order_by("slug")
    return {
        **serialize_user(user),
        "memberships": [
            {
                "workspace_id": str(m.workspace_id),
                "slug": m.workspace.slug,
                "name": m.workspace.name,
                "role": m.role,
                "is_active": m.is_active,
            }
            for m in memberships
        ],
        "owned_workspaces": [{"id": str(w.id), "slug": w.slug, "name": w.name} for w in owned],
    }


def lifecycle_error(error, http_status=status.HTTP_400_BAD_REQUEST):
    return Response({"error": error.message, **error.payload}, status=http_status)


class InstanceUserEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def get(self, request):
        users = annotated_users()
        if parse_bool(request.query_params.get("include_deleted")) is not True:
            users = users.filter(deleted_at__isnull=True)
        for key in ("is_active", "is_bot"):
            value = parse_bool(request.query_params.get(key))
            if value is not None:
                users = users.filter(**{key: value})
        search = request.query_params.get("search")
        if search:
            users = users.filter(
                Q(email__icontains=search)
                | Q(display_name__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )
        return self.paginate(
            request=request,
            queryset=users.order_by("-date_joined"),
            on_results=lambda results: [serialize_user(user) for user in results],
            max_per_page=100,
            default_per_page=25,
        )


class InstanceUserDetailEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def get(self, request, pk):
        user = get_object_or_404(annotated_users(), pk=pk)
        return Response(serialize_user_detail(user), status=status.HTTP_200_OK)

    def delete(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        if user.pk == request.user.pk:
            return Response({"error": "You cannot delete your own account here."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            soft_delete_user(user)
        except UserLifecycleError as error:
            http_status = status.HTTP_409_CONFLICT if error.payload else status.HTTP_400_BAD_REQUEST
            return lifecycle_error(error, http_status)
        return Response(status=status.HTTP_204_NO_CONTENT)


class InstanceUserDeactivateEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk, deleted_at__isnull=True)
        if user.pk == request.user.pk:
            return Response(
                {"error": "You cannot deactivate your own account here."}, status=status.HTTP_400_BAD_REQUEST
            )
        result = deactivate_user(user, current_site=base_host(request=request, is_app=True))
        return Response({**result, "user": serialize_user(annotated_users().get(pk=pk))}, status=status.HTTP_200_OK)


class InstanceUserReactivateEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def post(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        try:
            reactivate_user(user)
        except UserLifecycleError as error:
            return lifecycle_error(error)
        return Response({"user": serialize_user(annotated_users().get(pk=pk))}, status=status.HTTP_200_OK)


class InstanceUserMergeEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    dry_run = False

    def post(self, request, pk):
        survivor = get_object_or_404(User, pk=pk)
        source_id = request.data.get("source")
        if not source_id:
            return Response({"error": "source is required"}, status=status.HTTP_400_BAD_REQUEST)
        source = get_object_or_404(User, pk=source_id)
        keep_source_email = bool(parse_bool(request.data.get("keep_source_email")))
        try:
            result = merge_users(
                survivor,
                source,
                keep_source_email=keep_source_email,
                dry_run=self.dry_run,
                actor=request.user,
            )
        except MergeError as error:
            return lifecycle_error(error)
        except UserLifecycleError as error:
            return lifecycle_error(error, status.HTTP_409_CONFLICT)
        return Response(result, status=status.HTTP_200_OK)


class InstanceUserMergePreviewEndpoint(InstanceUserMergeEndpoint):
    dry_run = True
