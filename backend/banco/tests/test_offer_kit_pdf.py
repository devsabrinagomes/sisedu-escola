from datetime import timedelta
import importlib.util
import unittest

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from banco.models import Booklet, Offer


@unittest.skipIf(importlib.util.find_spec("weasyprint") is None, "weasyprint não instalado")
class OfferKitPdfTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(username="owner", password="test123")
        self.other = user_model.objects.create_user(username="other", password="test123")
        self.booklet = Booklet.objects.create(name="Caderno 1", created_by=self.owner.id)
        today = timezone.localdate()
        self.offer = Offer.objects.create(
            booklet=self.booklet,
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=1),
            description="Oferta teste",
            created_by=self.owner.id,
        )

    def test_owner_can_download_offer_kit_pdf(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse("offer-kit-pdf", args=[self.offer.id, "prova"])

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertIn("attachment;", response["Content-Disposition"])

    def test_other_user_cannot_download_offer_kit_pdf(self):
        self.client.force_authenticate(user=self.other)
        url = reverse("offer-kit-pdf", args=[self.offer.id, "prova"])

        response = self.client.get(url)

        self.assertEqual(response.status_code, 403)
