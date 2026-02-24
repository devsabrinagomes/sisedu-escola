from datetime import timedelta

from django.contrib.auth import get_user_model
from django.urls import reverse
from django.utils import timezone
from rest_framework.test import APITestCase

from banco.models import (
    Application,
    Booklet,
    BookletItem,
    Descriptor,
    Offer,
    Question,
    QuestionOption,
    QuestionVersion,
    Skill,
    StudentAnswer,
    Subject,
    Topic,
)


class OfferReportsTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(username="owner", password="test123")
        self.other = user_model.objects.create_user(username="other", password="test123")
        self.client.force_authenticate(user=self.owner)

        subject = Subject.objects.create(name="Matematica")
        topic = Topic.objects.create(description="Algebra", subject=subject)
        descriptor = Descriptor.objects.create(name="Descritor", code="D1", topic=topic)
        skill = Skill.objects.create(name="Habilidade", code="H1", descriptor=descriptor)

        question_1 = Question.objects.create(private=False, created_by=self.owner.id)
        version_1 = QuestionVersion.objects.create(
            question=question_1,
            version_number=1,
            title="Q1",
            support_text="",
            command="Comando Q1",
            subject=subject,
            descriptor=descriptor,
            skill=skill,
        )
        QuestionOption.objects.create(question_version=version_1, letter="A", option_text="A", correct=True)
        QuestionOption.objects.create(question_version=version_1, letter="B", option_text="B", correct=False)

        question_2 = Question.objects.create(private=False, created_by=self.owner.id)
        version_2 = QuestionVersion.objects.create(
            question=question_2,
            version_number=1,
            title="Q2",
            support_text="",
            command="Comando Q2",
            subject=subject,
            descriptor=descriptor,
            skill=skill,
        )
        QuestionOption.objects.create(question_version=version_2, letter="B", option_text="B", correct=True)
        QuestionOption.objects.create(question_version=version_2, letter="C", option_text="C", correct=False)

        booklet = Booklet.objects.create(name="Caderno 1", created_by=self.owner.id)
        item_1 = BookletItem.objects.create(booklet=booklet, question_version=version_1, order=1)
        item_2 = BookletItem.objects.create(booklet=booklet, question_version=version_2, order=2)

        today = timezone.localdate()
        self.offer = Offer.objects.create(
            booklet=booklet,
            start_date=today - timedelta(days=1),
            end_date=today + timedelta(days=1),
            description="Oferta teste",
            created_by=self.owner.id,
        )

        app_1 = Application.objects.create(
            offer=self.offer,
            class_ref=903001,
            student_ref=7101,
            student_absent=False,
            finalized_at=timezone.now(),
            finalized_by=self.owner.id,
        )
        app_2 = Application.objects.create(
            offer=self.offer,
            class_ref=903001,
            student_ref=7102,
            student_absent=False,
        )
        Application.objects.create(
            offer=self.offer,
            class_ref=903001,
            student_ref=7199,
            student_absent=True,
        )

        StudentAnswer.objects.create(
            application=app_1,
            booklet_item=item_1,
            selected_option="A",
            is_correct=True,
        )
        StudentAnswer.objects.create(
            application=app_1,
            booklet_item=item_2,
            selected_option="C",
            is_correct=False,
        )
        StudentAnswer.objects.create(
            application=app_2,
            booklet_item=item_1,
            selected_option="B",
            is_correct=False,
        )

    def test_offer_report_summary_returns_expected_payload(self):
        url = reverse("offer-report-summary", args=[self.offer.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["items_total"], 2)
        self.assertEqual(response.data["students_total"], 3)
        self.assertEqual(response.data["absent_count"], 1)
        self.assertEqual(response.data["finalized_count"], 1)
        self.assertEqual(response.data["in_progress_count"], 1)
        self.assertEqual(response.data["avg_correct"], 0.5)
        self.assertEqual(response.data["avg_correct_pct"], 25.0)
        self.assertEqual(response.data["distribution"], [{"correct": 0, "count": 1}, {"correct": 1, "count": 1}, {"correct": 2, "count": 0}])
        self.assertEqual(len(response.data["students"]), 3)
        self.assertEqual(len(response.data["items"]), 2)

        first_item = response.data["items"][0]
        self.assertEqual(first_item["order"], 1)
        self.assertEqual(first_item["correct_pct"], 50.0)
        self.assertEqual(first_item["wrong_pct"], 50.0)
        self.assertEqual(first_item["blank_pct"], 0.0)
        self.assertEqual(first_item["most_marked_option"], "A")
        self.assertEqual(first_item["total_answered"], 2)

    def test_offer_report_students_csv_download(self):
        url = reverse("offer-report-students-csv", args=[self.offer.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])
        content = response.content.decode("utf-8")
        self.assertIn("student_ref;name;class_ref;correct;wrong;blank;total;correct_pct;status", content)
        self.assertIn("7101;Beatriz Martins;903001;1;1;0;2;50.0;FINALIZED", content)

    def test_offer_report_invalid_class_ref_returns_400(self):
        url = reverse("offer-report-summary", args=[self.offer.id])

        response = self.client.get(url, {"class_ref": "x"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("class_ref", response.data)

    def test_non_owner_cannot_access_offer_reports(self):
        self.client.force_authenticate(user=self.other)
        url = reverse("offer-report-summary", args=[self.offer.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, 403)

    def test_offer_report_summary_accepts_school_ref_and_serie(self):
        url = reverse("offer-report-summary", args=[self.offer.id])

        response = self.client.get(url, {"school_ref": "1201", "serie": "1"})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["students_total"], 3)
        self.assertIn("totals", response.data)
        self.assertIn("accuracy_buckets", response.data)

    def test_reports_overview_returns_expected_payload(self):
        url = reverse("reports-overview")

        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertIn("offers_active", response.data)
        self.assertIn("offers_closed", response.data)
        self.assertIn("offers_total", response.data)
        self.assertIn("applications_total", response.data)
        self.assertIn("answered_total", response.data)
        self.assertIn("finalized_total", response.data)
        self.assertIn("absent_total", response.data)
        self.assertIn("finalization_rate_pct", response.data)
        self.assertIn("top_offers_finalization", response.data)
        self.assertIn("accuracy_buckets_overall", response.data)
        self.assertIn("recent_offers", response.data)

    def test_reports_by_class_returns_expected_payload(self):
        item_1 = BookletItem.objects.filter(booklet=self.offer.booklet, order=1).first()
        item_2 = BookletItem.objects.filter(booklet=self.offer.booklet, order=2).first()
        app_extra = Application.objects.create(
            offer=self.offer,
            class_ref=903002,
            student_ref=7103,
            student_absent=False,
            finalized_at=timezone.now(),
            finalized_by=self.owner.id,
        )
        StudentAnswer.objects.create(
            application=app_extra,
            booklet_item=item_1,
            selected_option="A",
            is_correct=True,
        )
        StudentAnswer.objects.create(
            application=app_extra,
            booklet_item=item_2,
            selected_option="B",
            is_correct=True,
        )

        url = reverse("reports-by-class", args=[self.offer.id])
        response = self.client.get(url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)

        first = response.data[0]
        self.assertEqual(first["class_id"], 903001)
        self.assertEqual(first["class_name"], "1º Ano Integral A")
        self.assertEqual(first["total_students"], 3)
        self.assertEqual(first["absent_count"], 1)
        self.assertEqual(first["absent_percent"], 33.33)
        self.assertEqual(first["accuracy_percent"], 16.67)

        second = response.data[1]
        self.assertEqual(second["class_id"], 903002)
        self.assertEqual(second["class_name"], "1º Ano Integral B")
        self.assertEqual(second["total_students"], 1)
        self.assertEqual(second["absent_count"], 0)
        self.assertEqual(second["absent_percent"], 0.0)
        self.assertEqual(second["accuracy_percent"], 100.0)

    def test_non_owner_cannot_access_reports_by_class(self):
        self.client.force_authenticate(user=self.other)
        url = reverse("reports-by-class", args=[self.offer.id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, 403)

    def test_reports_by_class_accepts_school_ref_and_serie(self):
        app_from_other_serie = Application.objects.create(
            offer=self.offer,
            class_ref=904001,
            student_ref=7105,
            student_absent=False,
        )
        item_1 = BookletItem.objects.filter(booklet=self.offer.booklet, order=1).first()
        StudentAnswer.objects.create(
            application=app_from_other_serie,
            booklet_item=item_1,
            selected_option="A",
            is_correct=True,
        )

        url = reverse("reports-by-class", args=[self.offer.id])
        response = self.client.get(url, {"school_ref": "1201", "serie": "1"})

        self.assertEqual(response.status_code, 200)
        class_ids = [row["class_id"] for row in response.data]
        self.assertEqual(class_ids, [903001])
