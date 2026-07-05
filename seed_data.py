import os
import django

# Set up Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from categories.models import Category

User = get_user_model()

def seed():
    print("Seeding database...")

    # 1. Create Categories
    categories_data = [
        {
            "name": "Academic",
            "description": "Exam, grading, attendance, curriculum, and class schedules.",
            "default_dept": "CS",
            "is_active": True
        },
        {
            "name": "Administrative",
            "description": "Fee structures, documents issuing, library resources, and hostel details.",
            "default_dept": "Administration",
            "is_active": True
        },
        {
            "name": "Facility",
            "description": "Lab equipment, classroom setup, maintenance, electricity, and water supply.",
            "default_dept": "Maintenance",
            "is_active": True
        },
        {
            "name": "Faculty Conduct",
            "description": "Inappropriate behavior, availability, class cancellation, and bias concerns.",
            "default_dept": "CS",
            "is_active": True
        },
        {
            "name": "Technical/IT",
            "description": "Network access, internet connection, portal login issues, and software resources.",
            "default_dept": "IT Support",
            "is_active": True
        },
        {
            "name": "Other",
            "description": "Miscellaneous issues not fitting other categories.",
            "default_dept": "General Office",
            "is_active": True
        }
    ]

    for cat in categories_data:
        category, created = Category.objects.get_or_create(
            name=cat["name"],
            defaults={
                "description": cat["description"],
                "default_dept": cat["default_dept"],
                "is_active": cat["is_active"]
            }
        )
        if created:
            print(f"Created category: {category.name}")
        else:
            print(f"Category already exists: {category.name}")

    # 2. Create Demo Users
    users_data = [
        {
            "email": "student@nec.edu.np",
            "username": "student",
            "full_name": "Aditya Chaudhary",
            "password": "Password123",
            "role": "student",
            "department": "CS",
            "phone": "9841234567"
        },
        {
            "email": "faculty@nec.edu.np",
            "username": "faculty",
            "full_name": "Dr. Abhash Kharel",
            "password": "Password123",
            "role": "faculty",
            "department": "CS",
            "phone": "9851234567"
        },
        {
            "email": "admin@nec.edu.np",
            "username": "admin",
            "full_name": "Bishal Subedi",
            "password": "Password123",
            "role": "admin",
            "department": "CS",
            "phone": "9861234567"
        }
    ]

    for u_data in users_data:
        user_exists = User.objects.filter(email=u_data["email"]).exists()
        if not user_exists:
            user = User.objects.create_user(
                username=u_data["username"],
                email=u_data["email"],
                password=u_data["password"],
                full_name=u_data["full_name"],
                role=u_data["role"],
                department=u_data["department"],
                phone=u_data["phone"]
            )
            print(f"Created user: {user.email} (Role: {user.role})")
        else:
            print(f"User already exists: {u_data['email']}")

    print("Seeding complete.")

if __name__ == "__main__":
    seed()
