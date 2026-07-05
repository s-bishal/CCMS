import csv
from django.http import HttpResponse
from rest_framework import status, permissions
from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from django.db.models import Count, Avg, F
from django.utils import timezone
from datetime import timedelta

from complaints.models import Complaint, StatusLog
from categories.models import Category
from core.utils import notify_status_transition

User = get_user_model()

class ReportSummaryView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role not in ['admin', 'superadmin']:
            return Response({'error': 'Only admins can view report summary.'}, status=status.HTTP_403_FORBIDDEN)
            
        total = Complaint.objects.count()
        
        # Breakdown by status
        status_data = Complaint.objects.values('status').annotate(count=Count('id'))
        status_counts = {item['status']: item['count'] for item in status_data}
        # Fill missing keys
        for key in ['submitted', 'assigned', 'in_progress', 'resolved', 'closed']:
            if key not in status_counts:
                status_counts[key] = 0
                
        # Breakdown by urgency
        urgency_data = Complaint.objects.values('urgency').annotate(count=Count('id'))
        urgency_counts = {item['urgency']: item['count'] for item in urgency_data}
        for key in ['low', 'medium', 'high', 'critical']:
            if key not in urgency_counts:
                urgency_counts[key] = 0
                
        # Breakdown by department
        dept_data = Complaint.objects.values('department').annotate(count=Count('id'))
        dept_counts = {item['department']: item['count'] for item in dept_data}
        
        # Breakdown by category
        category_data = Complaint.objects.values('category__name').annotate(count=Count('id'))
        category_counts = {item['category__name']: item['count'] for item in category_data if item['category__name']}

        # Resolution rate (resolved + closed / total)
        resolved_closed = status_counts.get('resolved', 0) + status_counts.get('closed', 0)
        resolution_rate = int((resolved_closed / total) * 100) if total > 0 else 0

        # Average Turnaround Time (in hours)
        resolved_complaints = Complaint.objects.filter(resolved_at__isnull=False)
        avg_turnaround_hours = 0
        if resolved_complaints.exists():
            durations = []
            for cmp in resolved_complaints:
                delta = cmp.resolved_at - cmp.created_at
                durations.append(delta.total_seconds() / 3600.0)
            avg_turnaround_hours = round(sum(durations) / len(durations), 1)

        return Response({
            'total_complaints': total,
            'status_counts': status_counts,
            'urgency_counts': urgency_counts,
            'department_counts': dept_counts,
            'category_counts': category_counts,
            'resolution_rate': resolution_rate,
            'average_turnaround_hours': avg_turnaround_hours
        })


class ReportExportView(APIView):
    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request):
        if request.user.role not in ['admin', 'superadmin']:
            return Response({'error': 'Only admins can export complaints.'}, status=status.HTTP_403_FORBIDDEN)
            
        response = HttpResponse(content_type='text/csv')
        response['Content-Disposition'] = f'attachment; filename="complaints_report_{timezone.now().strftime("%Y%m%d_%H%M%S")}.csv"'

        writer = csv.writer(response)
        writer.writerow([
            'Complaint Code', 'Student Name', 'Student Email', 'Category', 'Department',
            'Title', 'Urgency', 'Status', 'Assigned Faculty', 'Is Anonymous',
            'Created At', 'Resolved At', 'Closed At', 'Resolution Text'
        ])

        complaints = Complaint.objects.all().select_related('student', 'assigned_to', 'category')
        for c in complaints:
            student_name = "Anonymous" if c.is_anonymous else c.student.full_name
            student_email = "Anonymous" if c.is_anonymous else c.student.email
            faculty_name = c.assigned_to.full_name if c.assigned_to else 'Unassigned'
            
            writer.writerow([
                c.complaint_code,
                student_name,
                student_email,
                c.category.name if c.category else 'N/A',
                c.department,
                c.title,
                c.urgency,
                c.status,
                faculty_name,
                'Yes' if c.is_anonymous else 'No',
                c.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                c.resolved_at.strftime('%Y-%m-%d %H:%M:%S') if c.resolved_at else '',
                c.closed_at.strftime('%Y-%m-%d %H:%M:%S') if c.closed_at else '',
                c.resolution_text or ''
            ])

        return response


class DemoSimulationView(APIView):
    """
    Simulation View for Mid-Term Defense.
    Allows simulating:
    1. 48-hour No Action Escalation check.
    2. 7-day Student Response Auto-Closure check.
    """
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        if request.user.role not in ['admin', 'superadmin']:
            return Response({'error': 'Only admins can run simulations.'}, status=status.HTTP_403_FORBIDDEN)
            
        sim_type = request.data.get('type') # 'escalate' or 'autoclose'
        
        system_user = User.objects.filter(role='superadmin').first() or request.user
        
        if sim_type == 'escalate':
            # Find complaints that are 'assigned' but have no action.
            # In a real check, we check if assigned_at or created_at was > 48 hours ago.
            # For simulation, we'll backdate all 'assigned' complaints to 3 days ago, and run the escalation check!
            assigned_list = Complaint.objects.filter(status='assigned', is_escalated=False)
            escalated_count = 0
            
            # Backdate
            three_days_ago = timezone.now() - timedelta(days=3)
            assigned_list.update(created_at=three_days_ago)
            
            # Now trigger escalation check
            # Find complaints that have been assigned for > 48 hours (we backdated them to 3 days ago)
            escalation_threshold = timezone.now() - timedelta(hours=48)
            overdue_complaints = Complaint.objects.filter(status='assigned', created_at__lt=escalation_threshold, is_escalated=False)
            
            for cmp in overdue_complaints:
                cmp.is_escalated = True
                cmp.save()
                escalated_count += 1
                
                # Log status log indicating escalation, and alert admin
                StatusLog.objects.create(
                    complaint=cmp,
                    changed_by=system_user,
                    old_status=cmp.status,
                    new_status=cmp.status,
                    notes="Auto-escalation triggered: No action taken within 48 hours."
                )
                # Alert admin
                admins = User.objects.filter(role='admin')
                for admin in admins:
                    notify_status_transition(cmp, system_user, 'assigned', 'assigned', f"CRITICAL: Complaint {cmp.complaint_code} is ESCALATED due to 48-hour inactivity.")

            return Response({
                'message': f"Escalation check run. Backdated assigned complaints and successfully escalated {escalated_count} complaint(s)."
            })
            
        elif sim_type == 'autoclose':
            # Find complaints that are 'resolved' but not closed.
            # In a real check, we check if resolved_at was > 7 days ago.
            # For simulation, we backdate all 'resolved' complaints resolved_at to 8 days ago and check!
            resolved_list = Complaint.objects.filter(status='resolved')
            closed_count = 0
            
            # Backdate
            eight_days_ago = timezone.now() - timedelta(days=8)
            resolved_list.update(resolved_at=eight_days_ago)
            
            # Now run auto-close checker
            close_threshold = timezone.now() - timedelta(days=7)
            overdue_resolutions = Complaint.objects.filter(status='resolved', resolved_at__lt=close_threshold)
            
            for cmp in overdue_resolutions:
                old_status = cmp.status
                cmp.status = 'closed'
                cmp.closed_at = timezone.now()
                cmp.save()
                closed_count += 1
                
                # Transition status notification
                notify_status_transition(
                    cmp,
                    system_user,
                    old_status,
                    'closed',
                    "System auto-closed complaint: No response from student within 7 days of resolution."
                )
                
            return Response({
                'message': f"Auto-close check run. Backdated resolved complaints and auto-closed {closed_count} complaint(s)."
            })
            
        else:
            return Response({'error': 'Invalid simulation type. Use escalate or autoclose.'}, status=status.HTTP_400_BAD_REQUEST)
