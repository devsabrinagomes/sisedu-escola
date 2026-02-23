from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from banco.models import Booklet, BookletItem, Descriptor, Question, QuestionVersion, Skill, Subject, Topic


class BookletAddQuestionTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.owner = user_model.objects.create_user(username="owner", password="test123")
        self.other_user = user_model.objects.create_user(username="other", password="test123")

        self.booklet = Booklet.objects.create(name="Caderno 1", created_by=self.owner.id)
        self.url = reverse("caderno-add-question", args=[self.booklet.id])

        self.subject = Subject.objects.create(name="Matematica")
        self.topic = Topic.objects.create(description="Algebra", subject=self.subject)
        self.descriptor = Descriptor.objects.create(name="Descritor", code="D1", topic=self.topic)
        self.skill = Skill.objects.create(name="Habilidade", code="H1", descriptor=self.descriptor)

    def _create_question_with_version(self, created_by):
        question = Question.objects.create(private=False, created_by=created_by)
        QuestionVersion.objects.create(
            question=question,
            version_number=1,
            title="Titulo",
            support_text="",
            command="Comando",
            subject=self.subject,
            descriptor=self.descriptor,
            skill=self.skill,
        )
        return question

    def test_owner_can_add_question_to_booklet(self):
        question = self._create_question_with_version(created_by=self.owner.id)
        self.client.force_authenticate(user=self.owner)

        response = self.client.post(self.url, {"question_id": question.id}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(BookletItem.objects.count(), 1)
        item = BookletItem.objects.first()
        self.assertEqual(response.data["id"], item.id)
        self.assertEqual(response.data["booklet"], self.booklet.id)
        self.assertEqual(response.data["question_id"], question.id)

    def test_cannot_duplicate_same_question_on_same_booklet(self):
        question = self._create_question_with_version(created_by=self.owner.id)
        self.client.force_authenticate(user=self.owner)

        first = self.client.post(self.url, {"question_id": question.id}, format="json")
        second = self.client.post(self.url, {"question_id": question.id}, format="json")

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)
        self.assertEqual(BookletItem.objects.count(), 1)

    def test_non_owner_cannot_add_question(self):
        question = self._create_question_with_version(created_by=self.owner.id)
        self.client.force_authenticate(user=self.other_user)

        response = self.client.post(self.url, {"question_id": question.id}, format="json")

        self.assertEqual(response.status_code, 403)
        self.assertEqual(BookletItem.objects.count(), 0)
