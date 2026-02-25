from django.db.models import Max
from rest_framework import serializers

from .models import Booklet, BookletItem, Offer, Question

class AddQuestionToBookletSerializer(serializers.Serializer):
    question_id = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        question_id = attrs["question_id"]
        booklet = self.context["booklet"]

        question = Question.objects.filter(id=question_id, deleted=False).first()
        if not question:
            raise serializers.ValidationError({"question_id": "Questão não encontrada."})

        already_exists = BookletItem.objects.filter(
            booklet=booklet,
            question_version__question_id=question.id,
        ).exists()
        if already_exists:
            raise serializers.ValidationError({"question_id": "Esta questão já foi adicionada neste caderno."})

        latest_version = question.versions.order_by("-version_number", "-created_at").first()
        if not latest_version:
            raise serializers.ValidationError({"question_id": "A questão não possui versão disponível."})

        attrs["question_version"] = latest_version
        return attrs

    def create(self, validated_data):
        booklet: Booklet = self.context["booklet"]
        question_version = validated_data["question_version"]
        max_order = booklet.items.aggregate(max_order=Max("order")).get("max_order") or 0

        return BookletItem.objects.create(
            booklet=booklet,
            question_version=question_version,
            order=max_order + 1,
        )


class BookletItemSerializer(serializers.ModelSerializer):
    question_id = serializers.IntegerField(source="question_version.question_id", read_only=True)
    question_version_data = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BookletItem
        fields = [
            "id",
            "booklet",
            "order",
            "question_id",
            "question_version",
            "question_version_data",
        ]

    def get_question_version_data(self, obj):
        version = getattr(obj, "question_version", None)
        if not version:
            return None
        subject = getattr(version, "subject", None)
        return {
            "id": version.id,
            "question": version.question_id,
            "version_number": version.version_number,
            "title": version.title,
            "subject": version.subject_id,
            "subject_name": getattr(subject, "name", None),
            "descriptor": version.descriptor_id,
            "skill": version.skill_id,
            "annulled": version.annulled,
            "created_at": version.created_at,
        }


class BookletSerializer(serializers.ModelSerializer):
    items = BookletItemSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Booklet
        fields = [
            "id",
            "name",
            "deleted",
            "created_at",
            "created_by",
            "items_count",
            "items",
        ]
        read_only_fields = ["id", "deleted", "created_at", "created_by", "items_count", "items"]

    def get_items_count(self, obj):
        return obj.items.count()


class OfferSerializer(serializers.ModelSerializer):
    booklet_name = serializers.CharField(source="booklet.name", read_only=True)

    class Meta:
        model = Offer
        fields = [
            "id",
            "booklet",
            "booklet_name",
            "start_date",
            "end_date",
            "description",
            "deleted",
            "created_at",
            "created_by",
        ]
        read_only_fields = ["id", "deleted", "created_at", "created_by", "booklet_name"]

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        description = attrs.get("description", getattr(self.instance, "description", None))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "A data de fim deve ser maior ou igual à data de início."}
            )

        if description is None or not str(description).strip():
            raise serializers.ValidationError(
                {"description": "Descrição é obrigatória."}
            )
        return attrs
