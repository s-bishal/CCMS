import os
from django.conf import settings
from notifications.models import Notification
from complaints.models import StatusLog
from django.contrib.auth import get_user_model

User = get_user_model()

def log_status_change(complaint, changed_by, old_status, new_status, notes=""):
    """
    Creates a record in StatusLog for auditing status transitions.
    """
    StatusLog.objects.create(
        complaint=complaint,
        changed_by=changed_by,
        old_status=old_status,
        new_status=new_status,
        notes=notes
    )

def send_alert(user, complaint, message):
    """
    Creates an in-app notification and prints a console email log.
    """
    # 1. Create in-app notification
    Notification.objects.create(
        user=user,
        complaint=complaint,
        message=message
    )
    
    # 2. Simulate email notification
    print(f"\n--- [MOCK EMAIL SENT] ---")
    print(f"To: {user.email}")
    print(f"Subject: [CCMS Alert] Update on Complaint {complaint.complaint_code}")
    print(f"Message: {message}")
    print(f"-------------------------\n")

def notify_status_transition(complaint, changed_by, old_status, new_status, notes=""):
    """
    Coordinates status logs, notification creation, and email simulation.
    """
    # Record the transition in the log
    log_status_change(complaint, changed_by, old_status, new_status, notes)
    
    # Send relevant alerts based on who changed the status and the new state
    student = complaint.student
    assigned_to = complaint.assigned_to
    
    # Find all admins
    admins = User.objects.filter(role='admin')
    
    if new_status == 'submitted':
        # Notify admins
        for admin in admins:
            send_alert(admin, complaint, f"A new complaint {complaint.complaint_code} was submitted by {student.full_name}.")
            
    elif new_status == 'assigned':
        # Notify student and assigned faculty
        send_alert(student, complaint, f"Your complaint {complaint.complaint_code} has been assigned to {assigned_to.full_name}.")
        if assigned_to:
            send_alert(assigned_to, complaint, f"Complaint {complaint.complaint_code} has been assigned to you. Priority: {complaint.urgency.upper()}.")
            
    elif new_status == 'in_progress':
        # Notify student
        send_alert(student, complaint, f"Faculty {changed_by.full_name} has updated your complaint {complaint.complaint_code} to 'In Progress'. Notes: {notes}")
        
    elif new_status == 'resolved':
        # Notify student
        send_alert(student, complaint, f"Your complaint {complaint.complaint_code} has been marked as Resolved by {changed_by.full_name}. Resolution: {notes}")
        
    elif new_status == 'closed':
        # Notify assigned faculty and admins
        msg = f"Complaint {complaint.complaint_code} has been closed by the student. Resolution accepted."
        if changed_by.role == 'admin':
            msg = f"Complaint {complaint.complaint_code} has been forcibly closed by Admin {changed_by.full_name}. Reason: {notes}"
            send_alert(student, complaint, msg)
            
        if assigned_to:
            send_alert(assigned_to, complaint, msg)
            
        for admin in admins:
            if admin != changed_by:
                send_alert(admin, complaint, msg)
                
    elif new_status == 'submitted' and old_status == 'resolved':
        # This is a rejection/reopen
        msg = f"Student rejected resolution for complaint {complaint.complaint_code} and reopened it. Feedback: {notes}"
        if assigned_to:
            send_alert(assigned_to, complaint, msg)
        for admin in admins:
            send_alert(admin, complaint, msg)
