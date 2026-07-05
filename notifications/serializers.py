from rest_framework import serializers
from .models import Notification

class NotificationSerializer(serializers.ModelSerializer):
    complaint_code = serializers.CharField(source='complaint.complaint_code', read_only=True)
    
    class Meta:
        model = Notification
        fields = ('id', 'complaint', 'complaint_code', 'message', 'is_read', 'created_at')
        read_only_fields = ('id', 'complaint', 'complaint_code', 'message', 'created_at')
