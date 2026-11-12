from django.db import transaction
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Policy, PolicyVersion, PolicyAcceptance
from .serializers import (
    PolicyAdminSerializer,
    PolicyAdminVersionSerializer,
    PolicyDraftSerializer,
    PolicyVersionPublicSerializer,
    PolicyAcceptanceAdminSerializer,
)
from core.api import PublicIDLookupMixin, is_valid_public_id
from core.caching import cache_public_api
from django.db.models import Prefetch


def _next_version_number(policy: Policy) -> str:
    """Return the next version identifier for a policy.

    A brand-new policy starts at 1.0. Otherwise the minor component of the most
    recent numeric version is bumped (1.0 -> 1.1 -> 1.2 ...). Non-parseable
    versions fall back to a timestamp-based identifier so the sequence stays
    strictly increasing and unique.
    """
    existing = list(policy.versions.values_list('version', flat=True))
    if not existing:
        return '1.0'

    def parse(v):
        try:
            major, minor = v.split('.')
            return int(major), int(minor)
        except (ValueError, AttributeError):
            return None

    parsed = [p for p in (parse(v) for v in existing) if p is not None]
    if not parsed:
        return timezone.now().strftime('%Y%m%d.%H%M%S')
    major, minor = max(parsed)
    return f'{major}.{minor + 1}'


class PolicyAccessPolicyMixin:
    """Every write action is admin-only; reads follow the concrete view."""


class PolicyViewSet(PublicIDLookupMixin, viewsets.ReadOnlyModelViewSet):
    """Admin-facing policy management. Read + guarded workflow actions.

    Public consumers never hit this viewset; they use PublicPolicyView below which
    returns published content only.
    """
    serializer_class = PolicyAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = Policy.objects.all()

    def _get_draft(self, policy):
        """Return the latest mutable draft version, if any."""
        return policy.versions.filter(status='draft').order_by('-created_at', '-id').first()

    @action(detail=True, methods=['get'], url_path='versions')
    def versions(self, request, pk=None):
        policy = self.get_object()
        qs = policy.versions.order_by('-created_at', '-id')
        return Response(PolicyAdminVersionSerializer(qs, many=True).data)

    @action(detail=True, methods=['post'], url_path='draft')
    def save_draft(self, request, pk=None):
        """Create or update a draft version. Never touches the published version."""
        policy = self.get_object()
        serializer = PolicyDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        title = data.get('title') or policy.title
        existing_draft = self._get_draft(policy)

        with transaction.atomic():
            if existing_draft:
                existing_draft.content = data['content']
                existing_draft.title = title
                if data.get('effective_date'):
                    existing_draft.effective_date = data['effective_date']
                existing_draft.change_summary = data.get('change_summary', existing_draft.change_summary)
                existing_draft.last_edited_by = request.user
                existing_draft.save()
                version = existing_draft
            else:
                version = PolicyVersion.objects.create(
                    policy=policy,
                    version=_next_version_number(policy),
                    title=title,
                    content=data['content'],
                    status='draft',
                    effective_date=data.get('effective_date') or timezone.now().date(),
                    change_summary=data.get('change_summary', ''),
                    created_by=request.user,
                    last_edited_by=request.user,
                )
        return Response(PolicyAdminVersionSerializer(version).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='publish')
    def publish(self, request, pk=None):
        """Publish an explicit version id (defaults to the latest draft).

        The previously published version is preserved as historical (archived), never
        deleted, so acceptance records continue to resolve to the text originally
        accepted.
        """
        policy = self.get_object()
        version_id = request.data.get('version_id')

        if version_id:
            try:
                target = policy.versions.get(pk=version_id)
            except PolicyVersion.DoesNotExist:
                return Response({'detail': 'Version not found for this policy.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            target = self._get_draft(policy)
            if not target:
                return Response({'detail': 'No draft available to publish.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            # Demote the current published version, if any, to archived (preserved).
            PolicyVersion.objects.filter(policy=policy, status='published').exclude(pk=target.pk).update(
                status='archived', updated_at=timezone.now()
            )
            target.status = 'published'
            target.published_at = timezone.now()
            if not target.effective_date:
                target.effective_date = timezone.now().date()
            target.last_edited_by = request.user
            target.save()
        return Response(PolicyAdminVersionSerializer(target).data)

    @action(detail=True, methods=['post'], url_path='unpublish')
    def unpublish(self, request, pk=None):
        """Remove the current published version from public display without deleting
        history. The version becomes 'unpublished' and remains inspectable."""
        policy = self.get_object()
        current = policy.current_version
        if not current:
            return Response({'detail': 'No published version to unpublish.'}, status=status.HTTP_400_BAD_REQUEST)
        current.status = 'unpublished'
        current.last_edited_by = request.user
        current.save()
        return Response(PolicyAdminSerializer(policy).data)

    @action(detail=True, methods=['post'], url_path='restore')
    def restore(self, request, pk=None):
        """Restore a historical version by creating a NEW draft based on its content.
        Intervening history is preserved; nothing is overwritten."""
        policy = self.get_object()
        version_id = request.data.get('version_id')
        try:
            source = policy.versions.get(pk=version_id)
        except (PolicyVersion.DoesNotExist, TypeError):
            return Response({'detail': 'Version not found for this policy.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            new_version = PolicyVersion.objects.create(
                policy=policy,
                version=_next_version_number(policy),
                title=source.title,
                content=source.content,
                status='draft',
                effective_date=timezone.now().date(),
                change_summary=f"Restored from version {source.version}",
                created_by=request.user,
                last_edited_by=request.user,
            )
        return Response(PolicyAdminVersionSerializer(new_version).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='archive')
    def archive(self, request, pk=None):
        policy = self.get_object()
        policy.is_archived = True
        policy.save()
        return Response(PolicyAdminSerializer(policy).data)

    @action(detail=True, methods=['post'], url_path='unarchive')
    def unarchive(self, request, pk=None):
        policy = self.get_object()
        policy.is_archived = False
        policy.save()
        return Response(PolicyAdminSerializer(policy).data)

    @action(detail=True, methods=['delete'], url_path='delete-draft')
    def delete_draft(self, request, pk=None):
        """Delete only the latest draft version. Published/historical versions and any
        version referenced by an acceptance record can never be deleted here."""
        policy = self.get_object()
        draft = self._get_draft(policy)
        if not draft:
            return Response({'detail': 'No draft version to delete.'}, status=status.HTTP_400_BAD_REQUEST)
        if draft.is_referenced_by_acceptance():
            return Response(
                {'detail': 'This version is referenced by acceptance records and cannot be deleted.'},
                status=status.HTTP_409_CONFLICT,
            )
        draft.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class PolicyVersionDetailView(APIView):
    """Admin: retrieve a single policy version (full detail incl. revision notes)."""
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        try:
            # Admin URLs may address a version by its UUID primary key or by
            # its MMSR public ID (spec §7).
            if is_valid_public_id(pk):
                version = PolicyVersion.objects.select_related(
                    'policy', 'created_by', 'last_edited_by').get(public_id=pk)
            else:
                version = PolicyVersion.objects.select_related(
                    'policy', 'created_by', 'last_edited_by').get(pk=pk)
        except (PolicyVersion.DoesNotExist, ValidationError):
            return Response({'detail': 'Not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PolicyAdminVersionSerializer(version).data)


class PublicPolicyListView(APIView):
    """Public: list the currently published content for all non-archived policies."""
    permission_classes = [permissions.AllowAny]

    @cache_public_api(timeout=60, prefix="policy_list")
    def get(self, request):
        policies = Policy.objects.filter(is_archived=False).prefetch_related(
            Prefetch('versions', queryset=PolicyVersion.objects.filter(status='published').order_by('-published_at'), to_attr='published_versions')
        )
        results = []
        for policy in policies:
            published_vers = getattr(policy, 'published_versions', None)
            current = published_vers[0] if published_vers else policy.current_version
            if not current:
                continue
            results.append({
                'policy_type': policy.policy_type,
                'title': current.title,
                'canonical_route': policy.canonical_route,
                'version': current.version,
                'effective_date': current.effective_date,
                'published_at': current.published_at,
            })
        return Response(results)


class PublicPolicyDetailView(APIView):
    """Public: return ONLY the latest published version for a canonical policy type.

    Drafts, internal revision notes and admin-only metadata are never exposed here.
    """
    permission_classes = [permissions.AllowAny]

    def get(self, request, policy_type):
        policy = Policy.objects.filter(policy_type=policy_type, is_archived=False).first()
        if not policy:
            return Response({'detail': 'Policy not available.'}, status=status.HTTP_404_NOT_FOUND)
        current = policy.current_version
        if not current:
            return Response({'detail': 'No published version available.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(PolicyVersionPublicSerializer(current).data)


class PolicyAcceptanceViewSet(PublicIDLookupMixin, viewsets.ReadOnlyModelViewSet):
    """Admin: read-only audit of policy acceptance records with filtering.

    No create/update/delete is exposed — acceptance records are append-only.
    """
    serializer_class = PolicyAcceptanceAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    queryset = PolicyAcceptance.objects.select_related('user', 'policy', 'policy_version', 'submission').all()

    @action(detail=True, methods=['get'], url_path='download')
    def download(self, request, pk=None):
        """Download the exact accepted policy content as a Markdown file.

        Serves the record's immutable content_snapshot (never the current policy),
        prefixed with an audit header identifying the acceptance record itself.
        """
        record = self.get_object()
        if record.user:
            full = record.user.get_full_name().strip()
            author_line = f'- Author: {full or "—"} <{record.user.email}>'
        else:
            author_line = '- Author: (user removed)'
        header_lines = [
            '# Policy Acceptance Record — Downloaded Evidence',
            '',
            f'- Acceptance ID: {record.public_id or record.id}',
            author_line,
            f'- Submission ID: {record.submission.public_id if record.submission_id and record.submission else "(submission removed)"}',
            f'- Policy: {record.get_policy_type_display()}',
            f'- Accepted Version: v{record.version_number or "—"}',
            f'- Version Reference: {record.policy_version_id or "—"}',
            f'- Accepted At (UTC): {record.accepted_at.isoformat()}',
            f'- Agreement: {record.agreement_text or "—"}',
            '',
            '---',
            '',
            '## Accepted Policy Content (stored snapshot)',
            '',
        ]
        if record.content_snapshot and record.content_snapshot.strip():
            body = '\n'.join(header_lines) + record.content_snapshot
        else:
            body = (
                '\n'.join(header_lines)
                + 'The historical content snapshot is unavailable for this record. '
                  'Only the immutable version reference above remains. Do not substitute '
                  'current policy text for the accepted text.'
            )
        filename = f'policy-acceptance-{record.public_id or "record"}-{record.policy_type}-v{record.version_number or "unknown"}.md'
        response = HttpResponse(body, content_type='text/markdown; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response

    def get_queryset(self):
        qs = super().get_queryset()
        p = self.request.query_params
        if p.get('user'):
            qs = qs.filter(user_id=p['user'])
        if p.get('policy_type'):
            qs = qs.filter(policy_type=p['policy_type'])
        if p.get('submission'):
            qs = qs.filter(submission_id=p['submission'])
        if p.get('date_from'):
            qs = qs.filter(accepted_at__date__gte=p['date_from'])
        if p.get('date_to'):
            qs = qs.filter(accepted_at__date__lte=p['date_to'])
        if p.get('search'):
            term = p['search']
            q = (
                Q(user__email__icontains=term)
                | Q(user__first_name__icontains=term)
                | Q(user__last_name__icontains=term)
                | Q(submission__title__icontains=term)
            )
            if term.isdigit():
                # Allow matching by numeric submission identifier too.
                q |= Q(submission_id=int(term))
            elif is_valid_public_id(term):
                # …or by the standardized public ID shown on every surface.
                q |= Q(submission__public_id=term) | Q(public_id=term)
            qs = qs.filter(q)
        return qs
