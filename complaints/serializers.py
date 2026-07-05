from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Complaint, Attachment, StatusLog
from categories.serializers import CategorySerializer
from accounts.serializers import UserSerializer

User = get_user_model()

class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ('id', 'file_name', 'file_type', 'file_size_kb', 'uploaded_at', 'file_path')

class StatusLogSerializer(serializers.ModelSerializer):
    changed_by_name = serializers.CharField(source='changed_by.full_name', read_only=True)
    changed_by_role = serializers.CharField(source='changed_by.role', read_only=True)

    class Meta:
        model = StatusLog
        fields = ('id', 'old_status', 'new_status', 'notes', 'changed_at', 'changed_by_name', 'changed_by_role')

class ComplaintSerializer(serializers.ModelSerializer):
    student_details = serializers.SerializerMethodField()
    assigned_to_details = UserSerializer(source='assigned_to', read_only=True)
    category_details = CategorySerializer(source='category', read_only=True)
    status_logs = StatusLogSerializer(many=True, read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)

    class Meta:
        model = Complaint
        fields = (
            'id', 'complaint_code', 'student_details', 'assigned_to_details', 'category_details',
            'department', 'title', 'description', 'urgency', 'status', 'is_anonymous',
            'resolution_text', 'is_escalated', 'created_at', 'updated_at', 'resolved_at',
            'closed_at', 'status_logs', 'attachments'
        )

    def get_student_details(self, obj):
        request = self.context.get('request')
        if not request or not request.user:
            return None
            
        user = request.user
        
        # Hide identity from faculty (and unauthenticated users, if any) if anonymous is true
        if obj.is_anonymous:
            if user.role == 'faculty':
                return {
                    'full_name': 'Anonymous Student',
                    'email': '',
                    'department': obj.department,
                    'phone': ''
                }
        
        # Otherwise, return full details
        return {
            'id': obj.student.id,
            'full_name': obj.student.full_name,
            'email': obj.student.email,
            'department': obj.student.department,
            'phone': obj.student.phone
        }

class ComplaintCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Complaint
        fields = ('title', 'description', 'category', 'department', 'urgency', 'is_anonymous')

    def create(self, validated_data):
        # Student is set via view
        return super().create(validated_data)
