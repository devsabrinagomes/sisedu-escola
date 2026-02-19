from django.db.models import Q
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser
from django_filters.rest_framework import DjangoFilterBackend
from .filters import QuestionFilter

from .models import Subject, Topic, Descriptor, Skill, Question
from .serializers import (
    SubjectSerializer,
    TopicSerializer,
    DescriptorSerializer,
    SkillSerializer,
    QuestionSerializer,
)
from .permissions import IsOwnerOrReadOnly


class SubjectViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Subject.objects.all().order_by("name")
    serializer_class = SubjectSerializer
    permission_classes = [IsAuthenticated]


class TopicViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = TopicSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Topic.objects.select_related("subject")
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
        )

        subject_id = self.request.query_params.get("subject")
        if subject_id:
            qs = qs.filter(descriptor__topic__subject_id=subject_id)

        return qs


class QuestionViewSet(viewsets.ModelViewSet):
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [DjangoFilterBackend]
    filterset_class = QuestionFilter


    def get_queryset(self):
        user = self.request.user
        qs = Question.objects.select_related(
            "subject",
            "skill",
            "created_by",
        ).prefetch_related("versions", "options")

        if not user.is_superuser:
            qs = qs.filter(Q(is_private=False) | Q(created_by=user))

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(versions__statement_html__icontains=search)
                | Q(subject__name__icontains=search)
                | Q(skill__code__icontains=search)
            ).distinct()

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
