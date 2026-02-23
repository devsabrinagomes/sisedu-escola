from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework.test import APITestCase

from banco.models import Question


class QuestionFilterTests(APITestCase):
    def setUp(self):
        user_model = get_user_model()
        self.user = user_model.objects.create_user(username="user1", password="test123")
        self.other_user = user_model.objects.create_user(username="user2", password="test123")
        self.url = reverse("question-list")

        self.mine_public = Question.objects.create(private=False, created_by=self.user.id)
        self.mine_private = Question.objects.create(private=True, created_by=self.user.id)
        self.other_public = Question.objects.create(private=False, created_by=self.other_user.id)
        self.other_private = Question.objects.create(private=True, created_by=self.other_user.id)

        self.client.force_authenticate(user=self.user)

    def _result_ids(self, response):
        return {item["id"] for item in response.data["results"]}

    def test_mine_filter_returns_only_authenticated_user_questions(self):
        response = self.client.get(self.url, {"mine": "true"})

        self.assertEqual(response.status_code, 200)
        self.assertSetEqual(
            self._result_ids(response),
            {self.mine_public.id, self.mine_private.id},
        )

    def test_public_pool_filter_returns_only_public_questions_from_other_users(self):
        response = self.client.get(self.url, {"public_pool": "true"})

        self.assertEqual(response.status_code, 200)
        self.assertSetEqual(self._result_ids(response), {self.other_public.id})

    def test_visibility_filter_accepts_public_and_private(self):
        public_response = self.client.get(self.url, {"visibility": "public"})
        private_response = self.client.get(self.url, {"visibility": "private"})

        self.assertEqual(public_response.status_code, 200)
        self.assertEqual(private_response.status_code, 200)
        self.assertSetEqual(
            self._result_ids(public_response),
            {self.mine_public.id, self.other_public.id},
        )
        self.assertSetEqual(self._result_ids(private_response), {self.mine_private.id})

    def test_created_by_filter_keeps_access_rules(self):
        mine_response = self.client.get(self.url, {"created_by": self.user.id})
        other_response = self.client.get(self.url, {"created_by": self.other_user.id})

        self.assertEqual(mine_response.status_code, 200)
        self.assertEqual(other_response.status_code, 200)
        self.assertSetEqual(
            self._result_ids(mine_response),
            {self.mine_public.id, self.mine_private.id},
        )
        self.assertSetEqual(self._result_ids(other_response), {self.other_public.id})
