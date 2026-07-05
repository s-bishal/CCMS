from rest_framework import serializers
from django.contrib.auth import get_user_model

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'username', 'full_name', 'role', 'department', 'phone', 'is_active', 'date_joined')
        read_only_fields = ('id', 'is_active', 'date_joined')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'full_name', 'role', 'department', 'phone')

    def create(self, validated_data):
        email = validated_data['email']
        username = email.split('@')[0] # Auto-generate username from email
        
        # Check if username exists and append suffix if needed
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1
            
        user = User.objects.create_user(
            username=username,
            email=email,
            password=validated_data['password'],
            full_name=validated_data['full_name'],
            role=validated_data.get('role', 'student'),
            department=validated_data.get('department', ''),
            phone=validated_data.get('phone', '')
        )
        return user
