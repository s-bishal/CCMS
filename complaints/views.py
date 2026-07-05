from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db.models import Q

from .models import Complaint, Attachment, StatusLog
from .serializers import ComplaintSerializer, ComplaintCreateSerializer, AttachmentSerializer
from categories.models import Category
from core.utils import notify_status_transition

User = get_user_model()

class ComplaintListCreateView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        user = request.user
        queryset = Complaint.objects.all().order_by('-created_at')
        
        # 1. Role-Based Access Control Filtering
        if user.role == 'student':
            queryset = queryset.filter(student=user)
        elif user.role == 'faculty':
            # Faculty sees complaints assigned to them, and respects anonymity
            queryset = queryset.filter(assigned_to=user)
        elif user.role in ['admin', 'superadmin']:
            pass # Admins can view all complaints
            
        # 2. Query Filtering
        search_query = request.query_params.get('search')
        if search_query:
            queryset = queryset.filter(
                Q(complaint_code__icontains=search_query) |
                Q(title__icontains=search_query) |
                Q(description__icontains=search_query)
            )
            
        category_id = request.query_params.get('category')
        if category_id:
            queryset = queryset.filter(category_id=category_id)
            
        department = request.query_params.get('department')
        if department:
            queryset = queryset.filter(department__iexact=department)
            
        status_param = request.query_params.get('status')
        if status_param:
            queryset = queryset.filter(status=status_param)
            
        urgency = request.query_params.get('urgency')
        if urgency:
            queryset = queryset.filter(urgency=urgency)
            
        serializer = ComplaintSerializer(queryset, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        # Only students can file complaints
        if request.user.role != 'student':
            return Response({'error': 'Only students are allowed to file complaints.'}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = ComplaintCreateSerializer(data=request.data)
        if serializer.is_valid():
            # Create complaint
            complaint = serializer.save(student=request.user)
            
            # Handle attachments if any
            files = request.FILES.getlist('attachments')
            for file in files:
                ext = file.name.split('.')[-1].lower()
                size_kb = int(file.size / 1024)
                Attachment.objects.create(
                    complaint=complaint,
                    file_path=file,
                    file_name=file.name,
                    file_type=ext,
                    file_size_kb=size_kb
                )
            
            # Send initial submission notification
            notify_status_transition(complaint, request.user, None, 'submitted', "Complaint submitted successfully.")
            
            # 3. Rule Engine: Auto-Assignment Rule Check
            # If category=Academic and department matches a Faculty department
            # Or Category has a default_dept configured matching the complaint's target department
            category_obj = complaint.category
            target_faculty = None
            
            # Example auto-assign rule: Academic CS HOD or match default dept
            if category_obj.name == 'Academic' and complaint.department.upper() == 'CS':
                # Assign to first Faculty user in CS department
                target_faculty = User.objects.filter(role='faculty', department__iexact='CS', is_active=True).first()
            elif category_obj.default_dept and category_obj.default_dept.lower() == complaint.department.lower():
                target_faculty = User.objects.filter(role='faculty', department__iexact=complaint.department, is_active=True).first()
                
            if target_faculty:
                old_status = complaint.status
                complaint.assigned_to = target_faculty
                complaint.status = 'assigned'
                complaint.save()
                notify_status_transition(complaint, request.user, old_status, 'assigned', "Auto-assigned based on department category rules.")

            return Response(ComplaintSerializer(complaint, context={'request': request}).data, status=status.HTTP_201_CREATED)
            
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ComplaintDetailView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self, pk, user):
        complaint = get_object_or_404(Complaint, pk=pk)
        # Check permissions
        if user.role == 'student' and complaint.student != user:
            return None
        if user.role == 'faculty' and complaint.assigned_to != user:
            return None
        return complaint

    def get(self, request, pk):
        complaint = self.get_object(pk, request.user)
        if not complaint:
            return Response({'error': 'Permission denied or complaint not found.'}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = ComplaintSerializer(complaint, context={'request': request})
        return Response(serializer.data)


class ComplaintAssignView(APIView):
    """
    Endpoint for Admin to assign a complaint to a faculty member.
    PATCH /api/complaints/{id}/assign/
    """
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, pk):
        if request.user.role not in ['admin', 'superadmin']:
            return Response({'error': 'Only admins can assign complaints.'}, status=status.HTTP_403_FORBIDDEN)
            
        complaint = get_object_or_404(Complaint, pk=pk)
        faculty_id = request.data.get('assigned_to')
        
        if not faculty_id:
            return Response({'error': 'Assigned faculty ID is required.'}, status=status.HTTP_400_BAD_REQUEST)
            
        faculty = get_object_or_404(User, pk=faculty_id, role='faculty')
        
        old_status = complaint.status
        complaint.assigned_to = faculty
        complaint.status = 'assigned'
        complaint.save()
        
        notes = request.data.get('notes', f"Assigned to {faculty.full_name} by Admin.")
        notify_status_transition(complaint, request.user, old_status, 'assigned', notes)
        
        return Response(ComplaintSerializer(complaint, context={'request': request}).data)


class ComplaintStatusUpdateView(APIView):
    """
    Endpoint for Faculty/Admin to update the status of a complaint.
    PATCH /api/complaints/{id}/status/
    """
    permission_classes = (permissions.IsAuthenticated,)

    def patch(self, request, pk):
        user = request.user
        complaint = get_object_or_404(Complaint, pk=pk)
        
        # Verify access: must be assigned faculty or admin
        if user.role == 'faculty' and complaint.assigned_to != user:
            return Response({'error': 'You can only update complaints assigned to you.'}, status=status.HTTP_403_FORBIDDEN)
        if user.role not in ['faculty', 'admin', 'superadmin']:
            return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
            
        new_status = request.data.get('status')
        notes = request.data.get('notes', '')
        
        if new_status not in ['in_progress', 'resolved']:
            return Response({'error': 'Invalid status. Faculty can only set status to in_progress or resolved.'}, status=status.HTTP_400_BAD_REQUEST)
            
        old_status = complaint.status
        complaint.status = new_status
        
        if new_status == 'resolved':
            resolution_text = request.data.get('resolution_text')
            if not resolution_text:
                return Response({'error': 'Resolution details are required when marking a complaint as Resolved.'}, status=status.HTTP_400_BAD_REQUEST)
            complaint.resolution_text = resolution_text
            # Trigger resolved_at timestamp in model save
            notes = resolution_text
            
        complaint.save()
        notify_status_transition(complaint, request.user, old_status, new_status, notes)
        
        return Response(ComplaintSerializer(complaint, context={'request': request}).data)


class ComplaintCloseView(APIView):
    """
    Endpoint for student to Accept/Reject resolution OR Admin to Force Close.
    POST /api/complaints/{id}/close/
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request, pk):
        user = request.user
        complaint = get_object_or_404(Complaint, pk=pk)
        action = request.data.get('action') # 'accept', 'reject', 'force_close'
        notes = request.data.get('notes', '')
        
        if action == 'force_close':
            if user.role not in ['admin', 'superadmin']:
                return Response({'error': 'Only admins can force close a complaint.'}, status=status.HTTP_403_FORBIDDEN)
            if not notes:
                return Response({'error': 'Justification is required for force closure.'}, status=status.HTTP_400_BAD_REQUEST)
                
            old_status = complaint.status
            complaint.status = 'closed'
            complaint.save()
            notify_status_transition(complaint, user, old_status, 'closed', f"Forcibly closed: {notes}")
            
        elif action == 'accept':
            if user != complaint.student:
                return Response({'error': 'Only the student who submitted the complaint can accept the resolution.'}, status=status.HTTP_403_FORBIDDEN)
            if complaint.status != 'resolved':
                return Response({'error': 'Complaint must be marked as Resolved before you can accept it.'}, status=status.HTTP_400_BAD_REQUEST)
                
            old_status = complaint.status
            complaint.status = 'closed'
            complaint.save()
            notify_status_transition(complaint, user, old_status, 'closed', "Resolution accepted by student.")
            
        elif action == 'reject':
            if user != complaint.student:
                return Response({'error': 'Only the student who submitted the complaint can reject the resolution.'}, status=status.HTTP_403_FORBIDDEN)
            if complaint.status != 'resolved':
                return Response({'error': 'Complaint must be marked as Resolved before you can reject it.'}, status=status.HTTP_400_BAD_REQUEST)
            if not notes:
                return Response({'error': 'Feedback/reason is required to reject a resolution.'}, status=status.HTTP_400_BAD_REQUEST)
                
            old_status = complaint.status
            complaint.status = 'submitted' # Reopened back to submitted queue
            complaint.save()
            notify_status_transition(complaint, user, old_status, 'submitted', f"Resolution rejected. Feedback: {notes}")
            
        else:
            return Response({'error': 'Invalid action. Specify accept, reject, or force_close.'}, status=status.HTTP_400_BAD_REQUEST)
            
        return Response(ComplaintSerializer(complaint, context={'request': request}).data)
