# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import re
from datetime import datetime, timezone as dt_timezone

# Django imports
from django.db.models.functions import Lower

# Third party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from plane.app.permissions import allow_permission, ROLE
from plane.app.serializers import (
    RequirementSerializer,
    RequirementRepositorySerializer,
)
from plane.bgtasks.requirement_sync_task import sync_requirements
from plane.db.models import Requirement, RequirementDocument, RequirementRepository, User
from plane.requirements import hosts
from plane.requirements.change import create_requirement, propose_change

from ..base import BaseAPIView, BaseViewSet


def _commit_identity(user, repository):
    """Author name/email for the commit, plus an optional co-author trailer."""
    author_name = user.display_name or f"{user.first_name or ''} {user.last_name or ''}".strip() or user.email
    co_author = (
        {"name": repository.co_author_name, "email": repository.co_author_email}
        if repository.co_author_email
        else None
    )
    return author_name, user.email, co_author


class RequirementRepositoryEndpoint(BaseAPIView):
    """Manage the per-project git repository config and trigger sync."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        repository = RequirementRepository.objects.filter(
            workspace__slug=slug, project_id=project_id
        ).first()
        if repository is None:
            return Response({}, status=status.HTTP_200_OK)
        return Response(
            RequirementRepositorySerializer(repository).data,
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN])
    def post(self, request, slug, project_id):
        """Create or update the repository config (one per project)."""
        repository = RequirementRepository.objects.filter(
            workspace__slug=slug, project_id=project_id
        ).first()
        serializer = RequirementRepositorySerializer(
            repository, data=request.data, partial=repository is not None
        )
        serializer.is_valid(raise_exception=True)
        serializer.save(project_id=project_id)
        return Response(
            RequirementRepositorySerializer(serializer.instance).data,
            status=status.HTTP_200_OK,
        )


class RequirementRepositorySyncEndpoint(BaseAPIView):
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id):
        repository = RequirementRepository.objects.filter(
            workspace__slug=slug, project_id=project_id
        ).first()
        if repository is None:
            return Response(
                {"error": "No requirements repository is configured for this project"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        sync_requirements.delay(str(repository.id))
        return Response(
            {"message": "Sync started"}, status=status.HTTP_200_OK
        )


class RequirementViewSet(BaseViewSet):
    """Read-only projection of the git-backed strictdoc requirements.

    Requirements are authored in git. Browsing reads the projected rows; edits
    go through `propose_change`, which writes back to git as a pull request.
    """

    model = Requirement
    serializer_class = RequirementSerializer

    def get_queryset(self):
        return Requirement.objects.filter(
            workspace__slug=self.kwargs.get("slug"),
            project_id=self.kwargs.get("project_id"),
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id):
        requirements = self.get_queryset()
        return Response(
            RequirementSerializer(requirements, many=True).data,
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, pk):
        requirement = self.get_queryset().filter(pk=pk).first()
        if requirement is None:
            return Response(
                {"error": "Requirement not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(
            RequirementSerializer(requirement).data,
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def history(self, request, slug, project_id, pk):
        """Cached git history for the requirement's document, enriched with host
        links and Plane users matched by commit email."""
        requirement = self.get_queryset().filter(pk=pk).first()
        if requirement is None:
            return Response({"error": "Requirement not found"}, status=status.HTTP_404_NOT_FOUND)

        repository = RequirementRepository.objects.filter(workspace__slug=slug, project_id=project_id).first()
        document = RequirementDocument.objects.filter(
            project_id=project_id, file_path=requirement.file_path
        ).first()
        commits = document.commits if document else []

        emails = {(c.get("email") or "").lower() for c in commits if c.get("email")}
        users = {}
        if emails:
            for user in User.objects.annotate(email_lower=Lower("email")).filter(email_lower__in=emails):
                users[user.email.lower()] = user

        repo_url = repository.repo_url if repository else None
        provider = repository.provider if repository else None

        enriched = []
        for c in commits:
            message = c.get("message", "")
            user = users.get((c.get("email") or "").lower())
            refs = (
                [{"number": n, "url": hosts.pull_request_url(repo_url, n, provider)} for n in re.findall(r"#(\d+)", message)]
                if repo_url
                else []
            )
            enriched.append(
                {
                    "sha": c.get("sha"),
                    "author": c.get("author"),
                    "email": c.get("email"),
                    "date": c.get("date"),
                    "message": message,
                    "commit_url": hosts.commit_url(repo_url, c.get("full_sha") or c.get("sha"), provider) if repo_url else None,
                    "refs": refs,
                    "user": {"id": str(user.id), "display_name": user.display_name, "email": user.email} if user else None,
                }
            )
        return Response(enriched, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id):
        """Add a new requirement to a document and open a git pull request."""
        repository = RequirementRepository.objects.filter(
            workspace__slug=slug, project_id=project_id
        ).first()
        if repository is None:
            return Response(
                {"error": "No requirements repository is configured for this project"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        file_path = (request.data.get("file_path") or "").strip()
        uid = (request.data.get("uid") or "").strip()
        title = (request.data.get("title") or "").strip()
        statement = request.data.get("statement") or ""
        fields = request.data.get("fields") or {}
        if not isinstance(fields, dict):
            fields = {}
        if not file_path or not uid or not title:
            return Response(
                {"error": "file_path, uid and title are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if self.get_queryset().filter(uid=uid).exists():
            return Response(
                {"error": f"A requirement with UID {uid} already exists"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stamp = datetime.now(dt_timezone.utc).strftime("%Y%m%d%H%M%S")
        branch = request.data.get("branch") or f"plane/new-{uid.lower()}-{stamp}"
        message = request.data.get("message") or f"Add {uid}"
        author_name, author_email, co_author = _commit_identity(request.user, repository)

        try:
            result = create_requirement(
                repository=repository,
                file_path=file_path,
                uid=uid,
                title=title,
                statement=statement,
                fields=fields,
                branch=branch,
                message=message,
                pr_title=message,
                pr_body=f"New requirement {uid} proposed from Plane.",
                author_name=author_name,
                author_email=author_email,
                co_author=co_author,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if not result["committed"]:
            return Response({"error": "The requirement produced no change"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "uid": uid,
                "pull_request_url": result["pull_request_url"],
                "branch": result["branch"],
                "compare_url": result["compare_url"],
                "pr_error": result["pr_error"],
            },
            status=status.HTTP_200_OK,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def propose_change(self, request, slug, project_id, pk):
        """Apply field edits to this requirement and open a git pull request."""
        requirement = self.get_queryset().filter(pk=pk).first()
        if requirement is None:
            return Response(
                {"error": "Requirement not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        repository = RequirementRepository.objects.filter(
            workspace__slug=slug, project_id=project_id
        ).first()
        if repository is None:
            return Response(
                {"error": "No requirements repository is configured for this project"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        edits = request.data.get("edits") or {}
        relations = request.data.get("relations")
        if not isinstance(edits, dict):
            edits = {}
        if not edits and relations is None:
            return Response(
                {"error": "No edits provided"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        stamp = datetime.now(dt_timezone.utc).strftime("%Y%m%d%H%M%S")
        branch = request.data.get("branch") or f"plane/{requirement.uid.lower()}-{stamp}"
        message = request.data.get("message") or f"Update {requirement.uid}"
        pr_title = request.data.get("title") or message
        pr_body = request.data.get("body") or f"Change to {requirement.uid} proposed from Plane."

        author_name, author_email, co_author = _commit_identity(request.user, repository)

        try:
            result = propose_change(
                repository=repository,
                requirement=requirement,
                edits=edits,
                branch=branch,
                message=message,
                pr_title=pr_title,
                pr_body=pr_body,
                author_name=author_name,
                author_email=author_email,
                co_author=co_author,
                relations=relations,
            )
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        if not result["committed"]:
            return Response({"error": "The edit produced no change"}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            {
                "pull_request_url": result["pull_request_url"],
                "branch": result["branch"],
                "compare_url": result["compare_url"],
                "pr_error": result["pr_error"],
            },
            status=status.HTTP_200_OK,
        )
