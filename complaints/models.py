from django.db import models
from django.conf import settings
from django.utils import timezone
from categories.models import Category

class Complaint(models.Model):
    URGENCY_CHOICES = (
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
        ('critical', 'Critical'),
    )

    STATUS_CHOICES = (
        ('submitted', 'Submitted'),
        ('assigned', 'Assigned'),
        ('in_progress', 'In Progress'),
        ('resolved', 'Resolved'),
        ('closed', 'Closed'),
    )

    complaint_code = models.CharField(max_length=20, unique=True, blank=True)
    student = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='student_complaints')
    assigned_to = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_complaints')
    category = models.ForeignKey(Category, on_delete=models.PROTECT, related_name='complaints')
    department = models.CharField(max_length=100)
    title = models.CharField(max_length=200)
    description = models.TextField()
    urgency = models.CharField(max_length=10, choices=URGENCY_CHOICES, default='medium')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='submitted')
    is_anonymous = models.BooleanField(default=False)
    resolution_text = models.TextField(blank=True, null=True)
    is_escalated = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    resolved_at = models.DateTimeField(blank=True, null=True)
    closed_at = models.DateTimeField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.complaint_code:
            current_year = timezone.now().year
            # Get latest count for current year
            count = Complaint.objects.filter(created_at__year=current_year).count() + 1
            self.complaint_code = f"CMP-{current_year}-{count:04d}"
        
        # Automatically update timestamps for status changes
        if self.id:
            orig = Complaint.objects.get(pk=self.id)
            if orig.status != self.status:
                if self.status == 'resolved':
                    self.resolved_at = timezone.now()
                elif self.status == 'closed':
                    self.closed_at = timezone.now()
        
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.complaint_code} - {self.title}"


class Attachment(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='attachments')
    file_path = models.FileField(upload_to='complaints/')
    file_name = models.CharField(max_length=200)
    file_type = models.CharField(max_length=10) # e.g. pdf, jpg, png
    file_size_kb = models.IntegerField()
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.file_name


class StatusLog(models.Model):
    complaint = models.ForeignKey(Complaint, on_delete=models.CASCADE, related_name='status_logs')
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    old_status = models.CharField(max_length=20, null=True, blank=True)
    new_status = models.CharField(max_length=20)
    notes = models.TextField(blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-changed_at']

    def __str__(self):
        return f"{self.complaint.complaint_code}: {self.old_status} -> {self.new_status} by {self.changed_by.full_name}"
