"""Authentication backend supporting personal-email OR work-email sign-in.

Invited staff log in with the work email a Super Admin assigned them, while
every existing account keeps signing in with its personal email. This extends
Django's ModelBackend rather than replacing it: password verification, the
``is_active`` gate and the timing-safe unknown-user hash path are all inherited
unchanged, and there is exactly one credential store (the User table).
"""
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend

UserModel = get_user_model()


class EmailOrWorkEmailBackend(ModelBackend):
    def authenticate(self, request, username=None, password=None, **kwargs):
        # 1. Standard path — USERNAME_FIELD (personal email) exact match.
        user = super().authenticate(request, username=username, password=password, **kwargs)
        if user is not None:
            return user

        # 2. Fallback — the administrative work email issued via invitation.
        identifier = username if username is not None else kwargs.get(UserModel.USERNAME_FIELD)
        if password is None or not identifier:
            return None
        try:
            candidate = UserModel._default_manager.get(work_email__iexact=identifier)
        except UserModel.DoesNotExist:
            return None
        except UserModel.MultipleObjectsReturned:
            # work_email is unique, so this can only mean corrupt data; refuse.
            return None
        if candidate.work_email and candidate.work_email.lower() != str(identifier).lower():
            return None

        # Re-enter ModelBackend with the canonical personal email so hashing,
        # is_active gating and last-login handling stay in Django's hands.
        return super().authenticate(request, username=candidate.email, password=password)
