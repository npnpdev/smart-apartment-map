from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone

class User(AbstractUser):
    email = models.EmailField(unique=True) #zeby tylko 1 konto na email
    deleted_at = models.DateTimeField(null=True, blank=True)

    USERNAME_FIELD = "email" #email jako glowny login
    REQUIRED_FIELDS = ["username"] #by nie zepsuc superuser

    def soft_delete(self):
        self.email = f"deleted_{self.pk}@deleted.invalid"
        self.username = f"deleted_{self.pk}"
        self.first_name = ""
        self.last_name = ""
        self.is_active = False
        self.is_staff = False
        self.is_superuser = False
        self.deleted_at = timezone.now()
        self.set_unusable_password()
        self.save()
