"""
URL configuration for backend project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path
from django.conf import settings
from django.conf.urls.static import static

# Import views from apps
from accounts.views import RegisterView, LoginView, LogoutView, ProfileView, UserListView, CsrfTokenView, AdminUserManageView
from complaints.views import (
    ComplaintListCreateView, ComplaintDetailView, ComplaintAssignView,
    ComplaintStatusUpdateView, ComplaintCloseView
)
from categories.views import CategoryListView
from notifications.views import NotificationListView, NotificationMarkReadView
from reports.views import ReportSummaryView, ReportExportView, DemoSimulationView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Auth endpoints
    path('api/auth/csrf/', CsrfTokenView.as_view(), name='csrf-token'),
    path('api/auth/register/', RegisterView.as_view(), name='register'),
    path('api/auth/login/', LoginView.as_view(), name='login'),
    path('api/auth/logout/', LogoutView.as_view(), name='logout'),
    path('api/auth/profile/', ProfileView.as_view(), name='profile'),
    path('api/auth/users/', UserListView.as_view(), name='users-list'),
    path('api/auth/users/<int:pk>/manage/', AdminUserManageView.as_view(), name='user-manage'),
    
    # Complaint endpoints
    path('api/complaints/', ComplaintListCreateView.as_view(), name='complaints-list-create'),
    path('api/complaints/<int:pk>/', ComplaintDetailView.as_view(), name='complaint-detail'),
    path('api/complaints/<int:pk>/assign/', ComplaintAssignView.as_view(), name='complaint-assign'),
    path('api/complaints/<int:pk>/status/', ComplaintStatusUpdateView.as_view(), name='complaint-status-update'),
    path('api/complaints/<int:pk>/close/', ComplaintCloseView.as_view(), name='complaint-close'),
    
    # Categories endpoints
    path('api/categories/', CategoryListView.as_view(), name='categories-list'),
    
    # Notifications endpoints
    path('api/notifications/', NotificationListView.as_view(), name='notifications-list'),
    path('api/notifications/read-all/', NotificationMarkReadView.as_view(), name='notifications-read-all'),
    path('api/notifications/<int:pk>/read/', NotificationMarkReadView.as_view(), name='notification-read'),
    
    # Reports & Demo Simulation endpoints
    path('api/reports/summary/', ReportSummaryView.as_view(), name='reports-summary'),
    path('api/reports/export/', ReportExportView.as_view(), name='reports-export'),
    path('api/reports/simulate/', DemoSimulationView.as_view(), name='reports-simulate'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

