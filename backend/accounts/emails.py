import logging

from django.conf import settings
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode

logger = logging.getLogger(__name__)


def build_password_reset_link(user):
    uid = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)
    return f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"


def send_password_reset_email(user):
    link = build_password_reset_link(user)
    minutes = settings.PASSWORD_RESET_TIMEOUT // 60
    try:
        send_mail(
            subject="Smart Apartment Map: reset hasła",
            message=(
                f"Cześć {user.username},\n\n"
                f"otrzymaliśmy prośbę o zresetowanie hasła do Twojego konta.\n"
                f"Aby ustawić nowe hasło, otwórz link (ważny przez {minutes} min):\n\n"
                f"{link}\n\n"
                f"Jeśli to nie Ty, zignoruj tę wiadomość. Hasło pozostanie bez zmian."
            ),
            from_email=None,
            recipient_list=[user.email],
        )
    except OSError:
        logger.exception("Nie udało się wysłać maila z resetem hasła do user_id=%s", user.pk)
