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
    Subject,
    Topic,
)


class ApplicationAnswersTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(username="owner", password="test123")
        self.client.force_authenticate(user=self.owner)

        self.subject = Subject.objects.create(name="Matematica")
        self.topic = Topic.objects.create(description="Algebra", subject=self.subject)
        self.descriptor = Descriptor.objects.create(name="Descritor", code="D1", topic=self.topic)
        self.skill = Skill.objects.create(name="Habilidade", code="H1", descriptor=self.descriptor)

        question = Question.objects.create(private=False, created_by=self.owner.id)
        version = QuestionVersion.objects.create(
            question=question,
            version_number=1,
            title="Titulo",
            support_text="",
            command="Comando",
            subject=self.subject,
            descriptor=self.descriptor,
            skill=self.skill,
        )
        QuestionOption.objects.create(question_version=version, letter="A", option_text="Alt A", correct=True)
        QuestionOption.objects.create(question_version=version, letter="B", option_text="Alt B", correct=False)

        self.booklet = Booklet.objects.create(name="Caderno 1", created_by=self.owner.id)
        self.booklet_item = BookletItem.objects.create(
            booklet=self.booklet,
            question_version=version,
            order=1,
        )

    def _build_application(self, start_offset_days: int, end_offset_days: int):
        today = timezone.localdate()
        offer = Offer.objects.create(
            booklet=self.booklet,
            start_date=today + timedelta(days=start_offset_days),
            end_date=today + timedelta(days=end_offset_days),
            description="Oferta teste",
            created_by=self.owner.id,
        )
        return Application.objects.create(
            offer=offer,
            class_ref=1,
            student_ref=101,
            student_absent=False,
        )

    def test_cannot_fill_answers_when_offer_is_closed(self):
        application = self._build_application(start_offset_days=-10, end_offset_days=-1)
        url = reverse("application-answers", args=[application.id])

        response = self.client.put(
            url,
            {"answers": [{"booklet_item": self.booklet_item.id, "selected_option": "A"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data.get("detail"),
            "Só é possível preencher o gabarito com a oferta aberta.",
        )

    def test_can_fill_answers_when_offer_is_open(self):
        application = self._build_application(start_offset_days=-1, end_offset_days=1)
        url = reverse("application-answers", args=[application.id])

        response = self.client.put(
            url,
            {"answers": [{"booklet_item": self.booklet_item.id, "selected_option": "A"}]},
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["summary"]["correct"], 1)
        self.assertEqual(response.data["summary"]["wrong"], 0)
