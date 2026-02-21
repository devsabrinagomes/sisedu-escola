from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.exceptions import PermissionDenied, ValidationError
from django_filters.rest_framework import DjangoFilterBackend

from .filters import QuestionFilter

from .models import Subject, Topic, Descriptor, Skill, Question, BookletItem
from .serializers import (
    SubjectSerializer,
    TopicSerializer,
    DescriptorSerializer,
    SkillSerializer,
    QuestionSerializer,
)
# from .permissions import IsOwnerOrReadOnly


class SubjectViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Subject.objects.all().order_by("name")
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]


class TopicViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TopicSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Topic.objects.select_related("subject").order_by("description", "id")
        subject_id = self.request.query_params.get("subject")
        return qs.filter(subject_id=subject_id) if subject_id else qs


class DescriptorViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = DescriptorSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Descriptor.objects.select_related("topic", "topic__subject").all().order_by("code", "id")

        topic_id = self.request.query_params.get("topic")
        subject_id = self.request.query_params.get("subject")

        if topic_id:
            qs = qs.filter(topic_id=topic_id)
        if subject_id:
            qs = qs.filter(topic__subject_id=subject_id)

        return qs


class SkillViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SkillSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Skill.objects.select_related(
            "descriptor",
            "descriptor__topic",
            "descriptor__topic__subject",
        ).order_by("code", "id")

        subject_id = self.request.query_params.get("subject")
        if subject_id:
            qs = qs.filter(descriptor__topic__subject_id=subject_id)

        return qs


class QuestionViewSet(viewsets.ModelViewSet):
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated]  # depois vc volta com IsOwnerOrReadOnly ajustado
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend]
    filterset_class = QuestionFilter

    def get_queryset(self):
        user = self.request.user

        qs = (
            Question.objects
            .filter(deleted=False)  # se você usa soft delete
            .prefetch_related(
                "versions",
                "versions__options",
            )
        )

        # como created_by é BigInteger (id), compare com user.id
        if not user.is_superuser:
            qs = qs.filter(Q(private=False) | Q(created_by=user.id))

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(versions__title__icontains=search)
                | Q(versions__command__icontains=search)
                | Q(versions__support_text__icontains=search)
                | Q(versions__subject__name__icontains=search)
                | Q(versions__skill__code__icontains=search)
                | Q(versions__skill__name__icontains=search)
            ).distinct()

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        # created_by é BigInteger, então salva o id do user
        serializer.save(created_by=self.request.user.id)

    def perform_destroy(self, instance):
        if instance.created_by != self.request.user.id:
            raise PermissionDenied("Você só pode remover questões criadas por você.")

        in_use = BookletItem.objects.filter(question_version__question=instance).exists()
        if in_use:
            raise ValidationError({"detail": "Esta questão está vinculada a um caderno e não pode ser removida."})

        # Soft delete para manter histórico e evitar deleção física
        instance.deleted = True
        instance.save(update_fields=["deleted"])
