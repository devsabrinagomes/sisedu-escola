from django.db.models import Max, Q
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import QuestionFilter
from .models import (
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
from .permissions import IsBookletOwner
from .serializers import (
    AddQuestionToBookletSerializer,
    BookletSerializer,
    ApplicationSyncSerializer,
    BookletItemSerializer,
    DescriptorSerializer,
    OfferSerializer,
    QuestionSerializer,
    SkillSerializer,
    StudentAnswersBulkUpsertSerializer,
    SubjectSerializer,
    TopicSerializer,
)


MOCK_SIGE_DATA = {
    "default": {
        "schools": [
            {"school_ref": 1101, "name": "EEEP X"},
            {"school_ref": 1102, "name": "EEM Y"},
        ],
        "classes_by_school": {
            1101: [
                {"class_ref": 901001, "name": "1º Ano Integral A", "year": 2026},
                {"class_ref": 901002, "name": "1º Ano Integral B", "year": 2026},
            ],
            1102: [
                {"class_ref": 902001, "name": "2º Ano Regular A", "year": 2026},
                {"class_ref": 902002, "name": "3º Ano Regular B", "year": 2026},
            ],
        },
        "students_by_class": {
            901001: [
                {"student_ref": 7001, "name": "Ana Clara Sousa"},
                {"student_ref": 7002, "name": "João Pedro Lima"},
                {"student_ref": 7003, "name": "Maria Eduarda Rocha"},
            ],
            901002: [
                {"student_ref": 7004, "name": "Lucas Gabriel Nunes"},
                {"student_ref": 7005, "name": "Pedro Henrique Alves"},
            ],
            902001: [
                {"student_ref": 7006, "name": "Bianca Fernandes Costa"},
                {"student_ref": 7007, "name": "Rafael Menezes Dias"},
            ],
            902002: [
                {"student_ref": 7008, "name": "Vitória Lima Santos"},
                {"student_ref": 7009, "name": "Arthur Silva Moura"},
            ],
        },
    },
    1: {
        "schools": [
            {"school_ref": 1201, "name": "EEFM Professor Arnaldo"},
            {"school_ref": 1202, "name": "EEMTI José de Alencar"},
        ],
        "classes_by_school": {
            1201: [
                {"class_ref": 903001, "name": "1º Ano A", "year": 2026},
                {"class_ref": 903002, "name": "1º Ano B", "year": 2026},
            ],
            1202: [
                {"class_ref": 904001, "name": "2º Ano A", "year": 2026},
            ],
        },
        "students_by_class": {
            903001: [
                {"student_ref": 7101, "name": "Beatriz Martins"},
                {"student_ref": 7102, "name": "Caio Augusto"},
            ],
            903002: [
                {"student_ref": 7103, "name": "Isabela Rocha"},
                {"student_ref": 7104, "name": "Gustavo Almeida"},
            ],
            904001: [
                {"student_ref": 7105, "name": "Fernanda Oliveira"},
                {"student_ref": 7106, "name": "Heitor Carvalho"},
            ],
        },
    },
}


def _get_mock_sige_for_user(user):
    if user and user.is_authenticated and user.id in MOCK_SIGE_DATA:
        return MOCK_SIGE_DATA[user.id]
    return MOCK_SIGE_DATA["default"]


def _build_booklet_items_queryset_for_offer(offer):
    return (
        offer.booklet.items.select_related(
            "question_version",
            "question_version__subject",
        )
        .prefetch_related("question_version__options")
        .order_by("order", "id")
    )


def _get_correct_option_letter(question_version):
    option = (
        QuestionOption.objects.filter(question_version=question_version, correct=True)
        .order_by("letter")
        .first()
    )
    if not option or not option.letter:
        # TODO backend: quando houver outra regra de gabarito em QuestionVersion, aplicar aqui.
        return None
    return str(option.letter).strip().upper()


def _compute_application_summary(application, items_total):
    answers_qs = application.answers.all()
    answered_qs = answers_qs.exclude(selected_option__isnull=True).exclude(selected_option="")
    answered_count = answered_qs.count()
    correct = answered_qs.filter(is_correct=True).count()
    wrong = max(answered_count - correct, 0)
    blank = max(items_total - answered_count, 0)

    if application.finalized_at:
        status = "FINALIZED"
    elif application.student_absent:
        status = "ABSENT"
    elif answered_count > 0:
        status = "MANUAL"
    else:
        status = "NONE"

    return {
        "correct": correct,
        "wrong": wrong,
        "blank": blank,
        "status": status,
    }


def _serialize_booklet_item_for_answers(item):
    version = item.question_version
    subject = getattr(version, "subject", None)
    return {
        "id": item.id,
        "order": item.order,
        "question_version": {
            "id": version.id,
            "question": version.question_id,
            "version_number": version.version_number,
            "title": version.title,
            "command": version.command,
            "subject": version.subject_id,
            "subject_name": getattr(subject, "name", None),
        },
    }


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

    def _ensure_owner(self, instance):
        if self.request.user.is_superuser:
            return
        if instance.created_by != self.request.user.id:
            raise PermissionDenied("Voce so pode alterar questoes criadas por voce.")

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_owner(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_owner(instance)
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self._ensure_owner(instance)

        in_use = BookletItem.objects.filter(question_version__question=instance).exists()
        if in_use:
            raise ValidationError({"detail": "Esta questao esta vinculada a um caderno e nao pode ser removida."})

        instance.deleted = True
        instance.save(update_fields=["deleted"])


class BookletViewSet(viewsets.ModelViewSet):
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

    def _ensure_owner(self, instance):
        if self.request.user.is_superuser:
            return
        if instance.created_by != self.request.user.id:
            raise PermissionDenied("Voce so pode alterar cadernos criados por voce.")

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_owner(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_owner(instance)
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self._ensure_owner(instance)
        instance.deleted = True
        instance.save(update_fields=["deleted"])


class OfferViewSet(viewsets.ModelViewSet):
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

    def _ensure_owner(self, instance):
        if self.request.user.is_superuser:
            return
        if instance.created_by != self.request.user.id:
            raise PermissionDenied("Voce so pode alterar ofertas criadas por voce.")

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_owner(instance)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._ensure_owner(instance)
        return super().partial_update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        self._ensure_owner(instance)
        instance.deleted = True
        instance.save(update_fields=["deleted"])


class MockSigeSchoolsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        data = _get_mock_sige_for_user(request.user)
        return Response(data.get("schools", []), status=status.HTTP_200_OK)


class MockSigeSchoolClassesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, school_ref):
        data = _get_mock_sige_for_user(request.user)
        classes = data.get("classes_by_school", {}).get(int(school_ref), [])
        return Response(classes, status=status.HTTP_200_OK)


class MockSigeClassStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, class_ref):
        data = _get_mock_sige_for_user(request.user)
        students = data.get("students_by_class", {}).get(int(class_ref), [])
        return Response(students, status=status.HTTP_200_OK)


class OfferApplicationsSyncView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_offer(self, request, offer_id):
        offer = get_object_or_404(Offer.objects.select_related("booklet"), id=offer_id, deleted=False)
        if not request.user.is_superuser and offer.created_by != request.user.id:
            raise PermissionDenied("Você não tem permissão para gerenciar gabaritos desta oferta.")
        return offer

    def post(self, request, offer_id):
        offer = self._get_offer(request, offer_id)
        serializer = ApplicationSyncSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        class_ref = payload["class_ref"]
        students = payload["students"]
        items_total = offer.booklet.items.count()

        with transaction.atomic():
            for student in students:
                Application.objects.get_or_create(
                    offer=offer,
                    class_ref=class_ref,
                    student_ref=student["student_ref"],
                    defaults={
                        "student_absent": False,
                    },
                )

        applications = (
            Application.objects.filter(offer=offer, class_ref=class_ref)
            .prefetch_related("answers")
            .order_by("student_ref", "id")
        )
        names_by_ref = {int(student["student_ref"]): student.get("name", "") for student in students}

        rows = []
        for application in applications:
            summary = _compute_application_summary(application, items_total)
            rows.append(
                {
                    "application_id": application.id,
                    "student_ref": application.student_ref,
                    "student_name": names_by_ref.get(int(application.student_ref), f"Aluno {application.student_ref}"),
                    "student_absent": application.student_absent,
                    "finalized_at": application.finalized_at,
                    "correct": summary["correct"],
                    "wrong": summary["wrong"],
                    "blank": summary["blank"],
                    "status": summary["status"],
                }
            )

        return Response(
            {
                "offer_id": offer.id,
                "class_ref": class_ref,
                "items_total": items_total,
                "applications": rows,
            },
            status=status.HTTP_200_OK,
        )


class ApplicationAnswersView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_application(self, request, application_id):
        application = get_object_or_404(
            Application.objects.select_related("offer", "offer__booklet"),
            id=application_id,
            offer__deleted=False,
        )
        if not request.user.is_superuser and application.offer.created_by != request.user.id:
            raise PermissionDenied("Você não tem permissão para alterar respostas desta aplicação.")
        return application

    def _build_response(self, application):
        offer = application.offer
        booklet_items = list(_build_booklet_items_queryset_for_offer(offer))
        answers_qs = application.answers.select_related("booklet_item").all()
        answers_by_item = {answer.booklet_item_id: answer for answer in answers_qs}

        items_total = len(booklet_items)
        summary = _compute_application_summary(application, items_total)

        return {
            "application_id": application.id,
            "offer_id": offer.id,
            "booklet_id": offer.booklet_id,
            "items_total": items_total,
            "booklet_items": [_serialize_booklet_item_for_answers(item) for item in booklet_items],
            "answers": [
                {
                    "booklet_item": item.id,
                    "selected_option": answers_by_item.get(item.id).selected_option if answers_by_item.get(item.id) else None,
                    "is_correct": answers_by_item.get(item.id).is_correct if answers_by_item.get(item.id) else False,
                }
                for item in booklet_items
            ],
            "summary": summary,
        }

    def get(self, request, application_id):
        application = self._get_application(request, application_id)
        return Response(self._build_response(application), status=status.HTTP_200_OK)

    def put(self, request, application_id):
        application = self._get_application(request, application_id)
        serializer = StudentAnswersBulkUpsertSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload_answers = serializer.validated_data.get("answers", [])

        offer = application.offer
        booklet_items = list(_build_booklet_items_queryset_for_offer(offer))
        item_by_id = {item.id: item for item in booklet_items}

        with transaction.atomic():
            for row in payload_answers:
                booklet_item_id = row["booklet_item"]
                selected_option = row.get("selected_option", None)

                if booklet_item_id not in item_by_id:
                    raise ValidationError(
                        {"detail": f"booklet_item {booklet_item_id} não pertence ao caderno da oferta."}
                    )

                booklet_item = item_by_id[booklet_item_id]
                correct_letter = _get_correct_option_letter(booklet_item.question_version)
                is_correct = bool(selected_option and correct_letter and selected_option == correct_letter)

                StudentAnswer.objects.update_or_create(
                    application=application,
                    booklet_item=booklet_item,
                    defaults={
                        "selected_option": selected_option,
                        "is_correct": is_correct,
                    },
                )

        application.refresh_from_db()
        return Response(self._build_response(application), status=status.HTTP_200_OK)


class ApplicationAbsentView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_application(self, request, application_id):
        application = get_object_or_404(
            Application.objects.select_related("offer", "offer__booklet"),
            id=application_id,
            offer__deleted=False,
        )
        if not request.user.is_superuser and application.offer.created_by != request.user.id:
            raise PermissionDenied("Você não tem permissão para alterar esta aplicação.")
        return application

    def patch(self, request, application_id):
        application = self._get_application(request, application_id)
        if "student_absent" not in request.data:
            return Response(
                {"student_absent": "Este campo é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student_absent = bool(request.data.get("student_absent"))
        application.student_absent = student_absent
        application.save(update_fields=["student_absent"])

        items_total = application.offer.booklet.items.count()
        summary = _compute_application_summary(application, items_total)

        return Response(
            {
                "application_id": application.id,
                "student_absent": application.student_absent,
                "finalized_at": application.finalized_at,
                "correct": summary["correct"],
                "wrong": summary["wrong"],
                "blank": summary["blank"],
                "status": summary["status"],
            },
            status=status.HTTP_200_OK,
        )


class BookletAddQuestionView(APIView):
    permission_classes = [IsAuthenticated, IsBookletOwner]

    def post(self, request, id):
        booklet = get_object_or_404(Booklet, id=id, deleted=False)
        self.check_object_permissions(request, booklet)

        serializer = AddQuestionToBookletSerializer(
            data=request.data,
            context={"request": request, "booklet": booklet},
        )
        serializer.is_valid(raise_exception=True)
        item = serializer.save()

        output = BookletItemSerializer(item)
        return Response(output.data, status=status.HTTP_201_CREATED)


class BookletItemsView(APIView):
    permission_classes = [IsAuthenticated, IsBookletOwner]

    def _get_booklet(self, request, id):
        booklet = get_object_or_404(Booklet, id=id, deleted=False)
        self.check_object_permissions(request, booklet)
        return booklet

    def get(self, request, id):
        booklet = self._get_booklet(request, id)
        items = booklet.items.select_related("question_version", "question_version__subject").order_by("order")
        serializer = BookletItemSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, id):
        booklet = self._get_booklet(request, id)
        question_version_id = request.data.get("question_version")
        if not question_version_id:
            return Response(
                {"question_version": "Este campo é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        question_version = get_object_or_404(QuestionVersion, id=question_version_id)
        order = request.data.get("order")
        try:
            order = int(order) if order is not None else None
        except Exception:
            return Response({"order": "Valor inválido."}, status=status.HTTP_400_BAD_REQUEST)

        if order is None:
            max_order = booklet.items.aggregate(max_order=Max("order")).get("max_order") or 0
            order = max_order + 1

        item = BookletItem.objects.create(
            booklet=booklet,
            question_version=question_version,
            order=order,
        )
        serializer = BookletItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def put(self, request, id):
        booklet = self._get_booklet(request, id)
        payload = request.data if isinstance(request.data, list) else []
        if not isinstance(payload, list):
            return Response({"detail": "Payload deve ser uma lista."}, status=status.HTTP_400_BAD_REQUEST)

        seen_orders = set()
        seen_versions = set()
        rows = []
        for row in payload:
            qv_id = row.get("question_version")
            order = row.get("order")
            if qv_id is None or order is None:
                return Response(
                    {"detail": "Cada item deve ter question_version e order."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            try:
                qv_id = int(qv_id)
                order = int(order)
            except Exception:
                return Response({"detail": "question_version/order inválidos."}, status=status.HTTP_400_BAD_REQUEST)
            if qv_id in seen_versions:
                return Response({"detail": "question_version duplicado no payload."}, status=status.HTTP_400_BAD_REQUEST)
            if order in seen_orders:
                return Response({"detail": "order duplicado no payload."}, status=status.HTTP_400_BAD_REQUEST)
            seen_versions.add(qv_id)
            seen_orders.add(order)
            rows.append((qv_id, order))

        with transaction.atomic():
            booklet.items.all().delete()
            for qv_id, order in rows:
                question_version = get_object_or_404(QuestionVersion, id=qv_id)
                BookletItem.objects.create(
                    booklet=booklet,
                    question_version=question_version,
                    order=order,
                )

        items = booklet.items.select_related("question_version", "question_version__subject").order_by("order")
        serializer = BookletItemSerializer(items, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class BookletItemsBulkView(APIView):
    permission_classes = [IsAuthenticated, IsBookletOwner]

    def post(self, request, id):
        booklet = get_object_or_404(Booklet, id=id, deleted=False)
        self.check_object_permissions(request, booklet)
        payload = request.data if isinstance(request.data, list) else []
        if not isinstance(payload, list):
            return Response({"detail": "Payload deve ser uma lista."}, status=status.HTTP_400_BAD_REQUEST)

        created = []
        with transaction.atomic():
            for row in payload:
                qv_id = row.get("question_version")
                order = row.get("order")
                if qv_id is None or order is None:
                    return Response(
                        {"detail": "Cada item deve ter question_version e order."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                try:
                    qv_id = int(qv_id)
                    order = int(order)
                except Exception:
                    return Response({"detail": "question_version/order inválidos."}, status=status.HTTP_400_BAD_REQUEST)

                question_version = get_object_or_404(QuestionVersion, id=qv_id)
                created.append(
                    BookletItem.objects.create(
                        booklet=booklet,
                        question_version=question_version,
                        order=order,
                    )
                )

        serializer = BookletItemSerializer(created, many=True)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class BookletItemDetailView(APIView):
    permission_classes = [IsAuthenticated, IsBookletOwner]

    def _get_item(self, request, id, item_id):
        booklet = get_object_or_404(Booklet, id=id, deleted=False)
        self.check_object_permissions(request, booklet)
        item = get_object_or_404(BookletItem, id=item_id, booklet=booklet)
        return item

    def patch(self, request, id, item_id):
        item = self._get_item(request, id, item_id)
        order = request.data.get("order")
        if order is not None:
            try:
                item.order = int(order)
            except Exception:
                return Response({"order": "Valor inválido."}, status=status.HTTP_400_BAD_REQUEST)

        question_version_id = request.data.get("question_version")
        if question_version_id is not None:
            question_version = get_object_or_404(QuestionVersion, id=question_version_id)
            item.question_version = question_version

        item.save()
        serializer = BookletItemSerializer(item)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def delete(self, request, id, item_id):
        item = self._get_item(request, id, item_id)
        item.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
