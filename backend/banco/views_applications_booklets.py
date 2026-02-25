from .views_helpers import *  # noqa: F401,F403
from .views_helpers import (
    _build_booklet_items_queryset_for_offer,
    _compute_application_summary,
    _get_correct_option_letter,
    _is_offer_open,
    _serialize_booklet_item_for_answers,
)

class ApplicationAnswersView(OwnerAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def _get_application(self, request, application_id):
        return self.get_owned_application(
            request,
            application_id,
            message="Você não tem permissão para alterar respostas desta aplicação.",
        )

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
        if not _is_offer_open(application.offer):
            raise ValidationError({"detail": "Só é possível preencher o gabarito com a oferta aberta."})
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

            answered_count = (
                application.answers.exclude(selected_option__isnull=True)
                .exclude(selected_option="")
                .count()
            )
            items_total = len(booklet_items)
            if items_total > 0 and answered_count >= items_total:
                application.finalized_at = timezone.now()
                application.finalized_by = request.user.id
            else:
                application.finalized_at = None
                application.finalized_by = None
            application.save(update_fields=["finalized_at", "finalized_by"])

        application.refresh_from_db()
        return Response(self._build_response(application), status=status.HTTP_200_OK)


class ApplicationAbsentView(OwnerAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def _get_application(self, request, application_id):
        return self.get_owned_application(
            request,
            application_id,
            message="Você não tem permissão para alterar esta aplicação.",
        )

    def patch(self, request, application_id):
        application = self._get_application(request, application_id)
        if "student_absent" not in request.data:
            return Response(
                {"student_absent": "Este campo é obrigatório."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student_absent = bool(request.data.get("student_absent"))
        application.student_absent = student_absent
        if student_absent:
            application.finalized_at = None
            application.finalized_by = None
            application.save(update_fields=["student_absent", "finalized_at", "finalized_by"])
        else:
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
