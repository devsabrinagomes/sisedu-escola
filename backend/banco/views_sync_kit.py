from .views_helpers import *  # noqa: F401,F403
from .views_helpers import (
    _as_int,
    _as_list,
    _compute_application_summary,
    _get_mock_sige_for_user,
    _sige_enabled,
    _sige_get,
)

class MockSigeSchoolsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not _sige_enabled():
            data = _get_mock_sige_for_user(request.user)
            return Response(data.get("schools", []), status=status.HTTP_200_OK)

        payload = _sige_get("/escolas")
        schools_raw = _as_list(payload)
        schools = []
        for row in schools_raw:
            if not isinstance(row, dict):
                continue
            school_ref = _as_int(
                row.get("inep")
                or row.get("codigo_inep")
                or row.get("school_ref")
                or row.get("id")
            )
            name = str(
                row.get("nome")
                or row.get("nome_escola")
                or row.get("name")
                or ""
            ).strip()
            if school_ref is None or not name:
                continue
            schools.append({"school_ref": school_ref, "name": name})

        return Response(schools, status=status.HTTP_200_OK)


class MockSigeSchoolClassesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, school_ref):
        if not _sige_enabled():
            data = _get_mock_sige_for_user(request.user)
            classes = data.get("classes_by_school", {}).get(int(school_ref), [])
            return Response(classes, status=status.HTTP_200_OK)

        payload = _sige_get(f"/escolas/{school_ref}/turmas")
        classes_raw = _as_list(payload)
        classes = []
        for row in classes_raw:
            if not isinstance(row, dict):
                continue

            class_ref = _as_int(row.get("codigo") or row.get("class_ref") or row.get("id"))
            if class_ref is None:
                continue

            detail = _sige_get(f"/turmas/{class_ref}")
            if not isinstance(detail, dict):
                detail = {}

            class_name = str(
                row.get("nome")
                or row.get("descricao")
                or detail.get("nome")
                or detail.get("descricao")
                or f"Turma {class_ref}"
            ).strip()
            year_value = _as_int(
                row.get("ano_letivo")
                or detail.get("ano_letivo")
                or row.get("year")
                or detail.get("year")
            )
            year = year_value if year_value is not None else timezone.localdate().year

            classes.append(
                {
                    "class_ref": class_ref,
                    "name": class_name,
                    "year": year,
                    "etapa_aplicacao": detail.get("etapa_aplicacao"),
                    "serie": detail.get("serie"),
                }
            )

        return Response(classes, status=status.HTTP_200_OK)


class MockSigeClassStudentsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, class_ref):
        data = _get_mock_sige_for_user(request.user)
        students = data.get("students_by_class", {}).get(int(class_ref), [])
        return Response(students, status=status.HTTP_200_OK)


class OfferApplicationsSyncView(OwnerAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def _get_offer(self, request, offer_id):
        return self.get_owned_offer(
            request,
            offer_id,
            message="Você não tem permissão para gerenciar gabaritos desta oferta.",
        )

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


class OfferKitPdfView(OwnerAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def _get_offer(self, request, offer_id):
        return self.get_owned_offer(
            request,
            offer_id,
            message="Você não tem permissão para baixar o kit desta oferta.",
        )

    def get(self, request, offer_id, kind):
        offer = self._get_offer(request, offer_id)
        return _render_booklet_kit_pdf(
            request=request,
            booklet=offer.booklet,
            kind=kind,
            kit_name=offer.description or f"Oferta #{offer.id}",
            filename_prefix=f"oferta-{offer.id}",
        )


class BookletKitPdfView(OwnerAccessMixin, APIView):
    permission_classes = [IsAuthenticated]

    def _get_booklet(self, request, booklet_id):
        return self.get_owned_booklet(
            request,
            booklet_id,
            message="Você não tem permissão para baixar o kit deste caderno.",
        )

    def get(self, request, booklet_id, kind):
        booklet = self._get_booklet(request, booklet_id)
        return _render_booklet_kit_pdf(
            request=request,
            booklet=booklet,
            kind=kind,
            kit_name=booklet.name or f"Caderno #{booklet.id}",
            filename_prefix=f"caderno-{booklet.id}",
        )


def _choose_cards_per_sheet(total_questions):
    if total_questions <= 25:
        return 4
    if total_questions <= 35:
        return 3
    if total_questions <= 45:
        return 2
    return 1


def _split_two_cols(numbers):
    midpoint = (len(numbers) + 1) // 2
    return numbers[:midpoint], numbers[midpoint:]


def _render_booklet_kit_pdf(*, request=None, booklet, kind, kit_name, filename_prefix):
    try:
        from weasyprint import CSS, HTML
    except ModuleNotFoundError:
        raise ValidationError(
            {"detail": "WeasyPrint não está disponível neste ambiente do backend."}
        )

    booklet_items = list(
        booklet.items.select_related(
            "question_version",
            "question_version__skill",
        )
        .prefetch_related("question_version__options")
        .order_by("order", "id")
    )

    questions = []
    for index, item in enumerate(booklet_items, start=1):
        version = item.question_version
        options = [
            {"letter": opt.letter, "text": opt.option_text or "-"}
            for opt in version.options.all().order_by("letter")
        ]
        questions.append(
            {
                "number": index,
                "statement": version.command or version.title or "-",
                "skill_code": getattr(getattr(version, "skill", None), "code", "-"),
                "options": options,
            }
        )

    context = {
        "offer": {
            "id": booklet.id,
            "name": kit_name,
        },
        "discipline": "-",
        "grade": "-",
        "class_name": "-",
        "date": timezone.localdate().strftime("%d/%m/%Y"),
        "total_questions": len(questions),
        "questions": questions,
        "letters": ["A", "B", "C", "D", "E"],
    }

    css_path = str(settings.BASE_DIR / "banco" / "templates" / "pdf" / "pdf.css")
    base_url = request.build_absolute_uri("/") if request else str(settings.BASE_DIR)

    if kind == "prova":
        html_string = render_to_string("pdf/booklet.html", context)
        filename = f"{filename_prefix}-caderno-prova.pdf"
        stylesheets = [CSS(filename=css_path)]
    elif kind == "cartao-resposta":
        total_questions = len(questions)
        per_sheet = _choose_cards_per_sheet(total_questions)
        question_numbers = list(range(1, total_questions + 1))
        left_nums, right_nums = _split_two_cols(question_numbers)

        context.update(
            {
                "per_sheet": per_sheet,
                "cards": list(range(per_sheet)),
                "left_nums": left_nums,
                "right_nums": right_nums,
                "booklet_name": kit_name,
            }
        )
        html_string = render_to_string("pdf/answer_sheet_multi.html", context)
        filename = f"{filename_prefix}-cartao-resposta.pdf"
        stylesheets = []
    else:
        raise ValidationError({"detail": "Tipo de kit inválido."})

    try:
        pdf_bytes = HTML(string=html_string, base_url=base_url).write_pdf(stylesheets=stylesheets)
    except Exception as exc:
        raise ValidationError(
            {
                "detail": (
                    "Falha ao gerar PDF com WeasyPrint. "
                    f"Verifique compatibilidade das dependências ({type(exc).__name__}: {exc})."
                )
            }
        )
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
