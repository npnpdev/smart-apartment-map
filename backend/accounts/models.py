from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    email = models.EmailField(unique=True) #zeby tylko 1 konto na email

    USERNAME_FIELD = "email" #email jako glowny login
    REQUIRED_FIELDS = ["username"] #by nie zepsuc superuser