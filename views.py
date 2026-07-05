from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import authenticate, login, logout, get_user_model
from django.middleware.csrf import get_token
from django.views.decorators.csrf import ensure_csrf_cookie
from django.utils.decorators import method_decorator
from .serializers import UserSerializer, RegisterSerializer

User = get_user_model()


class CsrfTokenView(APIView):
    """
    GET /api/auth/csrf/
    Returns a fresh CSRF cookie. The frontend calls this before any
    unauthenticated POST (register, login) so Django has a valid token.
    """
    permission_classes = (permissions.AllowAny,)

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        token = get_token(request)
        return Response({'csrf_token': token})


class RegisterView(APIView):
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        # Block superadmin registration from public endpoint
        role = request.data.get('role', 'student')
        if role not in ('student', 'faculty', 'admin'):
            return Response(
                {'error': 'Invalid role. Choose student, faculty, or admin.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            return Response(UserSerializer(user).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(APIView):
    permission_classes = (permissions.AllowAny,)

    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        """
        GET /api/auth/login/ → just issues a fresh CSRF cookie (used on page load).
        """
        return Response({'csrf_token': get_token(request)})

    def post(self, request):
        email = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

        if not email or not password:
            return Response(
                {'error': 'Please provide both email and password'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Our custom EmailBackend uses 'username' kwarg mapped to email
        user = authenticate(request, username=email, password=password)

        if user is None:
            return Response(
                {'error': 'Invalid credentials. Check your email and password.'},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not user.is_active:
            return Response(
                {'error': 'This account has been deactivated.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        login(request, user)
        csrf_token = get_token(request)
        response_data = UserSerializer(user).data
        response_data['csrf_token'] = csrf_token
        return Response(response_data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        logout(request)
        return Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)


class ProfileView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        return Response(UserSerializer(request.user).data)

    def put(self, request):
        serializer = UserSerializer(request.user, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserListView(APIView):
    """
    GET /api/auth/users/?role=faculty  → list faculty members (for admin assignment dropdown)
    GET /api/auth/users/               → admin-only full user list
    """
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        role = request.query_params.get('role')
        users = User.objects.filter(is_active=True)

        if role:
            users = users.filter(role=role)

        # Only admins may list users freely; others may only view faculty list
        if request.user.role != 'admin' and role != 'faculty':
            return Response({'error': 'Permission denied'}, status=status.HTTP_403_FORBIDDEN)

        serializer = UserSerializer(users, many=True)
        return Response(serializer.data)


class AdminUserManageView(APIView):
    """
    Admin-only: activate/deactivate any user account or change their role.
    PATCH /api/auth/users/<pk>/manage/
    """
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, pk):
        if request.user.role != 'admin':
            return Response({'error': 'Only admins can manage user accounts.'}, status=status.HTTP_403_FORBIDDEN)

        try:
            target = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({'error': 'User not found.'}, status=status.HTTP_404_NOT_FOUND)

        is_active = request.data.get('is_active')
        new_role = request.data.get('role')

        if is_active is not None:
            target.is_active = bool(is_active)

        if new_role and new_role in ('student', 'faculty', 'admin'):
            target.role = new_role

        target.save()
        return Response(UserSerializer(target).data)
