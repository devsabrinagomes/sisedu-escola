import json

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from rest_framework import serializers

from banco.serializers import QuestionOptionSerializer, QuestionSerializer


class QuestionSerializerValidationTests(SimpleTestCase):
    def test_options_payload_requires_4_to_5_items(self):
        serializer = QuestionSerializer()

        with self.assertRaises(serializers.ValidationError):
            serializer._parse_options_payload(json.dumps([{"letter": "A", "correct": True}] * 3))

        with self.assertRaises(serializers.ValidationError):
            serializer._parse_options_payload(json.dumps([{"letter": "A", "correct": True}] * 6))

    def test_options_payload_requires_ordered_letters_for_4(self):
        serializer = QuestionSerializer()
        payload = [
            {"letter": "A", "correct": True},
            {"letter": "C", "correct": False},
            {"letter": "B", "correct": False},
            {"letter": "D", "correct": False},
        ]

        with self.assertRaises(serializers.ValidationError):
            serializer._parse_options_payload(json.dumps(payload))

    def test_options_payload_infers_letters_by_index(self):
        serializer = QuestionSerializer()
        payload = [
            {"correct": True},
            {"correct": False},
            {"correct": False},
            {"correct": False},
        ]

        parsed = serializer._parse_options_payload(json.dumps(payload))
        self.assertEqual([opt["letter"] for opt in parsed], ["A", "B", "C", "D"])


class QuestionOptionSerializerValidationTests(SimpleTestCase):
    def test_option_rejects_text_and_image_together(self):
        image = SimpleUploadedFile("alt.png", b"fake-image", content_type="image/png")
        serializer = QuestionOptionSerializer(
            data={
                "letter": "A",
                "option_text": "Texto",
                "option_image": image,
                "correct": True,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("option", serializer.errors)

    def test_option_rejects_without_text_and_without_image(self):
        serializer = QuestionOptionSerializer(
            data={
                "letter": "A",
                "correct": False,
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("option", serializer.errors)
