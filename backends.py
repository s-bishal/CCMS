from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model

User = get_user_model()

class EmailBackend(ModelBackend):
    """
    Custom authentication backend that allows login with email instead of username.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        # Support both 'username' kwarg (Django default) and 'email' kwarg
        email = username or kwargs.get('email')
        if not email:
            return None

        try:
            user = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return None

        if user.check_password(password) and self.user_can_authenticate(user):
            return user

        return None
