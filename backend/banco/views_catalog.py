from .views_helpers import *  # noqa: F401,F403

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


class QuestionViewSet(OwnerAccessMixin, viewsets.ModelViewSet):
    serializer_class = QuestionSerializer
    permission_classes = [IsAuthenticated]
    parser_classes = (JSONParser, FormParser, MultiPartParser)
    filter_backends = [DjangoFilterBackend]
    filterset_class = QuestionFilter

    def get_queryset(self):
        user = self.request.user

        qs = (
            Question.objects.filter(deleted=False)
            .prefetch_related(
                "versions",
                "versions__options",
            )
        )

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
        serializer.save(created_by=self.request.user.id)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self.ensure_owner(request, instance, "Voce so pode alterar questoes criadas por voce.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self.ensure_owner(request, instance, "Voce so pode alterar questoes criadas por voce.")
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self.ensure_owner(self.request, instance, "Voce so pode alterar questoes criadas por voce.")

        in_use = BookletItem.objects.filter(question_version__question=instance).exists()
        if in_use:
            raise ValidationError({"detail": "Esta questao esta vinculada a um caderno e nao pode ser removida."})

        self.soft_delete(instance)


class BookletViewSet(OwnerAccessMixin, viewsets.ModelViewSet):
    serializer_class = BookletSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Booklet.objects.filter(deleted=False).prefetch_related(
            "items",
            "items__question_version",
            "items__question_version__subject",
        )
        if user.is_superuser:
            return qs.order_by("-created_at")
        return qs.filter(created_by=user.id).order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user.id, deleted=False)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self.ensure_owner(request, instance, "Voce so pode alterar cadernos criados por voce.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self.ensure_owner(request, instance, "Voce so pode alterar cadernos criados por voce.")
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self.ensure_owner(self.request, instance, "Voce so pode alterar cadernos criados por voce.")
        self.soft_delete(instance)


class OfferViewSet(OwnerAccessMixin, viewsets.ModelViewSet):
    serializer_class = OfferSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Offer.objects.filter(deleted=False).select_related("booklet")
        if not user.is_superuser:
            qs = qs.filter(created_by=user.id)

        search = self.request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(description__icontains=search) | Q(booklet__name__icontains=search)
            )

        booklet = self.request.query_params.get("booklet")
        if booklet:
            qs = qs.filter(booklet_id=booklet)

        start_date = self.request.query_params.get("start_date")
        if start_date:
            qs = qs.filter(start_date__gte=start_date)

        end_date = self.request.query_params.get("end_date")
        if end_date:
            qs = qs.filter(end_date__lte=end_date)

        status = self.request.query_params.get("status")
        if status:
            today = timezone.localdate()
            if status == "upcoming":
                qs = qs.filter(start_date__gt=today)
            elif status == "open":
                qs = qs.filter(start_date__lte=today, end_date__gte=today)
            elif status == "closed":
                qs = qs.filter(end_date__lt=today)

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user.id, deleted=False)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self.ensure_owner(request, instance, "Voce so pode alterar ofertas criadas por voce.")
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self.ensure_owner(request, instance, "Voce so pode alterar ofertas criadas por voce.")
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self.ensure_owner(self.request, instance, "Voce so pode alterar ofertas criadas por voce.")
        self.soft_delete(instance)
