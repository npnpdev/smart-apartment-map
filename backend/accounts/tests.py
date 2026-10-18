import re
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

User = get_user_model()

PASSWORD = "Mieszkanie-Gdansk-2026"
NEW_PASSWORD = "Nowe-Haslo-Oliwa-77"


def create_user(email="jan@example.com", username="jan"):
    return User.objects.create_user(email=email, username=username, password=PASSWORD)


class PasswordResetTests(APITestCase):
    def setUp(self):
        self.user = create_user()

    def request_reset(self, email):
        return self.client.post(reverse("password_reset"), {"email": email}, format="json")

    def reset_link_parts(self):
        match = re.search(r"/reset-password/(?P<uid>[^/]+)/(?P<token>\S+)", mail.outbox[-1].body)
        return match["uid"], match["token"]

    def confirm(self, uid, token, password=NEW_PASSWORD):
        return self.client.post(
            reverse("password_reset_confirm"),
            {"uid": uid, "token": token, "new_password": password},
            format="json",
        )

    def test_request_sends_email_with_frontend_link(self):
        response = self.request_reset(self.user.email)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.user.email])
        self.assertIn("http://localhost:5173/reset-password/", mail.outbox[0].body)

    def test_request_for_unknown_email_looks_the_same_and_sends_nothing(self):
        known = self.request_reset(self.user.email)
        unknown = self.request_reset("nikt@example.com")

        self.assertEqual(unknown.status_code, status.HTTP_200_OK)
        self.assertEqual(unknown.data, known.data)
        self.assertEqual(len(mail.outbox), 1)

    def test_request_survives_smtp_failure_without_revealing_account(self):
        unknown = self.request_reset("nikt@example.com")
        with mock.patch("accounts.emails.send_mail", side_effect=ConnectionRefusedError):
            with self.assertLogs("accounts.emails", level="ERROR"):
                known = self.request_reset(self.user.email)

        self.assertEqual(known.status_code, status.HTTP_200_OK)
        self.assertEqual(known.data, unknown.data)

    def test_request_with_malformed_email_is_rejected(self):
        response = self.request_reset("to-nie-email")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_confirm_sets_new_password(self):
        self.request_reset(self.user.email)
        uid, token = self.reset_link_parts()

        response = self.confirm(uid, token)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(NEW_PASSWORD))
        login = self.client.post(
            reverse("jwt_login"), {"email": self.user.email, "password": NEW_PASSWORD}, format="json"
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

    def test_link_works_only_once(self):
        self.request_reset(self.user.email)
        uid, token = self.reset_link_parts()
        self.confirm(uid, token)

        response = self.confirm(uid, token, password="Jeszcze-Inne-Haslo-99")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("token", response.data)

    def test_confirm_rejects_tampered_token_and_uid(self):
        self.request_reset(self.user.email)
        uid, token = self.reset_link_parts()

        self.assertEqual(self.confirm(uid, token + "x").status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.confirm("nie-base64!", token).status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_confirm_runs_password_validators(self):
        self.request_reset(self.user.email)
        uid, token = self.reset_link_parts()

        response = self.confirm(uid, token, password="12345678")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("new_password", response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password(PASSWORD))

    def test_link_for_deleted_account_is_rejected(self):
        self.request_reset(self.user.email)
        uid, token = self.reset_link_parts()
        self.user.soft_delete()

        response = self.confirm(uid, token)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class DeleteAccountTests(APITestCase):
    def setUp(self):
        self.user = create_user()
        self.access = str(RefreshToken.for_user(self.user).access_token)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.access}")

    def delete_account(self, password=PASSWORD):
        return self.client.delete(reverse("me"), {"password": password}, format="json")

    def test_requires_authentication(self):
        self.client.credentials()

        response = self.delete_account()

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_wrong_password_keeps_account(self):
        response = self.delete_account(password="zle-haslo")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)
        self.assertIsNone(self.user.deleted_at)

    def test_missing_password_is_rejected(self):
        response = self.client.delete(reverse("me"))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_soft_deletes_and_anonymizes(self):
        user_id = self.user.pk

        response = self.delete_account()

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        user = User.objects.get(pk=user_id)
        self.assertFalse(user.is_active)
        self.assertIsNotNone(user.deleted_at)
        self.assertEqual(user.email, f"deleted_{user_id}@deleted.invalid")
        self.assertEqual(user.username, f"deleted_{user_id}")
        self.assertFalse(user.has_usable_password())

    def test_existing_token_stops_working(self):
        self.delete_account()

        response = self.client.get(reverse("me"))

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_cannot_log_in_after_deletion(self):
        self.delete_account()
        self.client.credentials()

        response = self.client.post(
            reverse("jwt_login"), {"email": "jan@example.com", "password": PASSWORD}, format="json"
        )

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_email_and_username_can_be_registered_again(self):
        self.delete_account()
        self.client.credentials()

        response = self.client.post(
            reverse("register"),
            {"email": "jan@example.com", "username": "jan", "password": PASSWORD},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertNotEqual(response.data["user"]["id"], self.user.pk)

    def test_password_reset_for_old_email_sends_nothing(self):
        self.delete_account()
        self.client.credentials()

        self.client.post(reverse("password_reset"), {"email": "jan@example.com"}, format="json")

        self.assertEqual(len(mail.outbox), 0)

    def test_anonymized_email_and_username_cannot_be_registered_up_front(self):
        self.client.credentials()

        response = self.client.post(
            reverse("register"),
            {"email": "deleted_999@deleted.invalid", "username": "Deleted_999", "password": PASSWORD},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("email", response.data)
        self.assertIn("username", response.data)
