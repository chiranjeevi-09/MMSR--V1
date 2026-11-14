import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
email = os.environ.get('DJANGO_SUPERUSER_EMAIL', 'admin@mmsrpublications.org')
password = os.environ.get('DJANGO_SUPERUSER_PASSWORD', 'Admin@123456')

if not User.objects.filter(email=email).exists():
    print(f"Creating superuser for {email}...")
    User.objects.create_superuser(
        email=email,
        password=password,
        first_name='Admin',
        last_name='MMSR'
    )
    print("Superuser created successfully!")
else:
    print(f"Superuser {email} already exists.")

# Automatically seed test Book and Journal with ₹1 price
try:
    from seed_test_data import seed_data
    seed_data()
except Exception as e:
    print(f"Warning during seed: {e}")


