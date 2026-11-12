from datetime import date

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from policies.models import Policy, PolicyVersion, PolicyAcceptance
from submissions.models import Submission

User = get_user_model()


def _make_admin(email='admin@mmsr.test'):
    return User.objects.create_user(email=email, password='pass12345', is_staff=True)


def _make_author(email='author@mmsr.test'):
    return User.objects.create_user(email=email, password='pass12345', is_author=True)


def _pdf(name='m.pdf'):
    return SimpleUploadedFile(name, b'%PDF-1.4 test content', content_type='application/pdf')


class PolicyWorkflowTests(APITestCase):
    def setUp(self):
        self.admin = _make_admin()
        self.author = _make_author()
        self.policy = Policy.objects.create(policy_type='terms', title='Terms and Conditions')

    def _publish(self, content, version='1.0'):
        v = PolicyVersion.objects.create(
            policy=self.policy, version=version, title=self.policy.title,
            content=content, status='draft', created_by=self.admin,
        )
        v.status = 'published'
        v.published_at = timezone.now()
        v.save()
        return v

    def test_admin_can_save_draft(self):
        self.client.force_authenticate(user=self.admin)
        url = reverse('policy-save-draft', kwargs={'pk': self.policy.pk})
        res = self.client.post(url, {'content': 'Draft body', 'effective_date': str(date.today())}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(self.policy.versions.filter(status='draft').count(), 1)

    def test_unauthorized_user_cannot_draft_publish_or_archive(self):
        self.client.force_authenticate(user=self.author)
        draft_url = reverse('policy-save-draft', kwargs={'pk': self.policy.pk})
        publish_url = reverse('policy-publish', kwargs={'pk': self.policy.pk})
        archive_url = reverse('policy-archive', kwargs={'pk': self.policy.pk})
        self.assertEqual(self.client.post(draft_url, {'content': 'x'}, format='json').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post(publish_url, {}, format='json').status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.client.post(archive_url, {}, format='json').status_code, status.HTTP_403_FORBIDDEN)

    def test_anonymous_cannot_access_admin_endpoints(self):
        url = reverse('policy-list')
        self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_public_endpoint_returns_only_published(self):
        self._publish('**Published body**')
        # Add a draft that must never appear publicly.
        PolicyVersion.objects.create(
            policy=self.policy, version='1.1', title='x', content='SECRET DRAFT', status='draft'
        )
        url = reverse('policy-public-detail', kwargs={'policy_type': 'terms'})
        res = self.client.get(url)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['version'], '1.0')
        self.assertIn('Published body', res.data['content'])
        self.assertNotIn('SECRET DRAFT', res.data['content'])

    def test_public_endpoint_404_when_nothing_published(self):
        PolicyVersion.objects.create(policy=self.policy, version='1.0', title='x', content='draft only', status='draft')
        url = reverse('policy-public-detail', kwargs={'policy_type': 'terms'})
        self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_publishing_preserves_previous_version(self):
        old = self._publish('OLD published', version='1.0')
        self.client.force_authenticate(user=self.admin)
        draft_url = reverse('policy-save-draft', kwargs={'pk': self.policy.pk})
        res = self.client.post(draft_url, {'content': 'NEW content'}, format='json')
        new_version_id = res.data['id']
        publish_url = reverse('policy-publish', kwargs={'pk': self.policy.pk})
        pres = self.client.post(publish_url, {'version_id': str(new_version_id)}, format='json')
        self.assertEqual(pres.status_code, status.HTTP_200_OK)

        old.refresh_from_db()
        self.assertEqual(old.status, 'archived')
        self.assertEqual(old.content, 'OLD published')  # historical content intact
        self.assertEqual(self.policy.current_version.version, '1.1')

    def test_restore_creates_new_version_without_destroying_history(self):
        v1 = self._publish('Version one', version='1.0')
        self.client.force_authenticate(user=self.admin)
        restore_url = reverse('policy-restore', kwargs={'pk': self.policy.pk})
        res = self.client.post(restore_url, {'version_id': str(v1.pk)}, format='json')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['status'], 'draft')
        self.assertEqual(res.data['content'], 'Version one')
        # The original published version is untouched.
        v1.refresh_from_db()
        self.assertEqual(v1.status, 'published')
        self.assertEqual(self.policy.versions.count(), 2)

    def test_draft_does_not_change_published_content(self):
        published = self._publish('LIVE')
        self.client.force_authenticate(user=self.admin)
        draft_url = reverse('policy-save-draft', kwargs={'pk': self.policy.pk})
        self.client.post(draft_url, {'content': 'WIP'}, format='json')
        published.refresh_from_db()
        self.assertEqual(published.status, 'published')
        self.assertEqual(published.content, 'LIVE')


class SubmissionAgreementEnforcementTests(APITestCase):
    def setUp(self):
        self.author = _make_author()
        self.admin = _make_admin()
        self.terms = Policy.objects.create(policy_type='terms', title='Terms and Conditions')
        self.ethics = Policy.objects.create(policy_type='publication_policies', title='Publication Policies and Ethics')
        self._publish(self.terms, 'TERMS LIVE v1.0')
        self._publish(self.ethics, 'ETHICS LIVE v1.0')
        self.url = reverse('submission-list')

    def _publish(self, policy, content):
        v = PolicyVersion.objects.create(
            policy=policy, version='1.0', title=policy.title, content=content, status='draft'
        )
        v.status = 'published'
        v.published_at = timezone.now()
        v.save()
        return v

    def _payload(self, **overrides):
        data = {
            'submission_type': 'journal_article',
            'title': 'A Study of Testing Methodologies',
            'abstract': 'An abstract long enough to satisfy requirements for the study.',
            'keywords': 'testing, quality',
            'country': 'India',
            'manuscript_file': _pdf(),
            'agreed_to_terms': True,
            'agreed_to_publication_policies': True,
        }
        data.update(overrides)
        return data

    def test_submission_without_agreement_is_rejected(self):
        self.client.force_authenticate(user=self.author)
        payload = self._payload(agreed_to_terms=False)
        res = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Submission.objects.count(), 0)

    def test_submission_missing_agreement_field_is_rejected(self):
        self.client.force_authenticate(user=self.author)
        payload = self._payload()
        payload.pop('agreed_to_publication_policies')
        res = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Submission.objects.count(), 0)

    def test_valid_submission_creates_acceptance_records(self):
        self.client.force_authenticate(user=self.author)
        before = timezone.now()
        res = self.client.post(self.url, self._payload(), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_201_CREATED, res.data)
        submission = Submission.objects.get()
        self.assertTrue(submission.agreed_to_terms)
        self.assertTrue(submission.agreed_to_publication_policies)

        records = PolicyAcceptance.objects.filter(submission=submission)
        self.assertEqual(records.count(), 2)
        types = set(records.values_list('policy_type', flat=True))
        self.assertEqual(types, {'terms', 'publication_policies'})

        terms_rec = records.get(policy_type='terms')
        self.assertEqual(terms_rec.user, self.author)          # derived from authenticated request
        self.assertEqual(terms_rec.version_number, '1.0')
        self.assertIn('TERMS LIVE v1.0', terms_rec.content_snapshot)
        self.assertGreaterEqual(terms_rec.accepted_at, before)  # server-generated timestamp

    def test_submission_rejected_when_policy_unpublished(self):
        # Unpublish ethics → no current published version.
        v = self.ethics.current_version
        v.status = 'unpublished'
        v.save()
        self.client.force_authenticate(user=self.author)
        res = self.client.post(self.url, self._payload(), format='multipart')
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(Submission.objects.count(), 0)

    def test_acceptance_record_survives_policy_update(self):
        self.client.force_authenticate(user=self.author)
        self.client.post(self.url, self._payload(), format='multipart')
        rec = PolicyAcceptance.objects.get(policy_type='terms')
        snapshot = rec.content_snapshot

        # Publish a new terms version (demote the current published one first).
        old_v = self.terms.current_version
        old_v.status = 'archived'
        old_v.save()
        new_v = PolicyVersion.objects.create(policy=self.terms, version='2.0', title='t', content='TERMS LIVE v2.0', status='draft')
        new_v.status = 'published'; new_v.published_at = timezone.now(); new_v.save()

        rec.refresh_from_db()
        self.assertEqual(rec.content_snapshot, snapshot)  # historical accepted text unchanged


class PolicyAcceptanceReadTests(APITestCase):
    def setUp(self):
        self.admin = _make_admin()
        self.author = _make_author()
        self.policy = Policy.objects.create(policy_type='terms', title='Terms')
        self.version = PolicyVersion.objects.create(policy=self.policy, version='1.0', title='Terms', content='c', status='published')
        self.record = PolicyAcceptance.objects.create(
            user=self.author, policy=self.policy, policy_version=self.version,
            policy_type='terms', version_number='1.0', content_snapshot='c',
        )

    def test_admin_can_list_records(self):
        self.client.force_authenticate(user=self.admin)
        res = self.client.get(reverse('policy-acceptance-list'))
        self.assertEqual(res.status_code, status.HTTP_200_OK)

    def test_non_admin_cannot_view_records(self):
        self.client.force_authenticate(user=self.author)
        res = self.client.get(reverse('policy-acceptance-list'))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_records_are_read_only(self):
        self.client.force_authenticate(user=self.admin)
        detail = reverse('policy-acceptance-detail', kwargs={'pk': self.record.pk})
        self.assertEqual(self.client.delete(detail).status_code, status.HTTP_405_METHOD_NOT_ALLOWED)
        self.assertEqual(
            self.client.patch(detail, {'version_number': 'X'}, format='json').status_code,
            status.HTTP_405_METHOD_NOT_ALLOWED,
        )
