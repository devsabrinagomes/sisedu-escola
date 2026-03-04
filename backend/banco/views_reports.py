import csv
from html import escape
from io import StringIO
from math import ceil

from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import CSS, HTML
from weasyprint.text.fonts import FontConfiguration

from .models import Booklet
from .views_sync_kit import _render_booklet_kit_pdf
from .views_helpers import *  # noqa: F401,F403
from .views_helpers import (
    _build_simple_pdf,
    _build_class_names_map,
    _build_csv_response,
    _get_offer_for_reports,
    _parse_class_ref,
    _parse_school_ref,
    _parse_serie,
    _resolve_filtered_class_refs,
    _resolve_report_data,
)


def preview_cartao_resposta_pdf(request):
    # Querystring de teste:
    # ?q=60 aumenta o total de questoes
    # ?booklet=Simulado%20ENEM%202026 troca o nome do caderno
    # ?cards=2 duplica o mesmo cartao em 2 paginas para validar repeticao
    try:
        total_questions = int(request.GET.get("q", 45))
    except (TypeError, ValueError):
        total_questions = 45
    total_questions = max(1, total_questions)

    booklet_name = (request.GET.get("booklet") or "Simulado ENEM 2026").strip() or "Simulado ENEM 2026"

    try:
        cards_count = int(request.GET.get("cards", 1))
    except (TypeError, ValueError):
        cards_count = 1
    cards_count = max(1, cards_count)
    landscape_mode = total_questions > 45

    nums = list(range(1, total_questions + 1))

    # O split divide as questoes em duas colunas quase iguais.
    # ceil garante que a coluna da esquerda receba a questao extra quando o total for impar.
    mid = ceil(len(nums) / 2)
    left_nums = nums[:mid]
    right_nums = nums[mid:]

    context = {
        "booklet_name": booklet_name,
        "left_nums": left_nums,
        "right_nums": right_nums,
        "cards": range(cards_count if "cards" in request.GET else (3 if landscape_mode else 4)),
        "total_questions": total_questions,
        "landscape_mode": landscape_mode,
    }

    html_string = render_to_string("pdf/answer_sheet_multi.html", context)

    # O base_url e necessario para o WeasyPrint resolver {% static %} e demais assets
    # a partir da URL raiz do projeto durante a geracao do PDF.
    font_config = FontConfiguration()
    pdf_bytes = HTML(
        string=html_string,
        base_url=request.build_absolute_uri("/"),
    ).write_pdf(font_config=font_config)

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="cartao_resposta_preview.pdf"'
    return response


def preview_caderno_prova_publico_pdf(request):
    booklet_id = request.GET.get("booklet_id")
    if booklet_id:
        try:
            booklet = Booklet.objects.get(pk=int(booklet_id))
        except (Booklet.DoesNotExist, TypeError, ValueError):
            booklet = None
        if booklet is not None:
            return _render_booklet_kit_pdf(
                request=request,
                booklet=booklet,
                kind="prova",
                kit_name=booklet.name or f"Caderno #{booklet.id}",
                filename_prefix=f"caderno-{booklet.id}",
                disposition="inline",
            )

    try:
        total_questions = int(request.GET.get("q", 5))
    except (TypeError, ValueError):
        total_questions = 5
    total_questions = max(1, total_questions)

    booklet_name = (request.GET.get("booklet") or "Simulado SAEB 2026").strip() or "Simulado SAEB 2026"
    questions = []
    for index in range(1, total_questions + 1):
        has_support = index % 3 == 0
        questions.append(
            {
                "number": index,
                "statement": "<p>Leia o enunciado da questão com atenção e selecione a alternativa correta.</p>",
                "support_image_url": "",
                "image_reference": (
                    "Texto de apoio: utilize as informações apresentadas para responder à questão."
                    if has_support
                    else ""
                ),
                "options": [
                    {"letter": "A", "text": "Alternativa A de exemplo.", "image_url": ""},
                    {"letter": "B", "text": "Alternativa B de exemplo.", "image_url": ""},
                    {"letter": "C", "text": "Alternativa C de exemplo.", "image_url": ""},
                    {"letter": "D", "text": "Alternativa D de exemplo.", "image_url": ""},
                    {"letter": "E", "text": "Alternativa E de exemplo.", "image_url": ""},
                ],
            }
        )

    context = {
        "offer": {"id": 1, "name": booklet_name},
        "generated_at": timezone.localtime().strftime("%d/%m/%Y %H:%M"),
        "questions": questions,
    }
    html_string = render_to_string("pdf/booklet.html", context)
    css_path = str(settings.BASE_DIR / "banco" / "templates" / "pdf" / "pdf.css")
    font_config = FontConfiguration()
    pdf_bytes = HTML(
        string=html_string,
        base_url=request.build_absolute_uri("/"),
    ).write_pdf(
        stylesheets=[CSS(filename=css_path, font_config=font_config)],
        font_config=font_config,
    )

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = 'inline; filename="caderno_prova_preview.pdf"'
    return response


def preview_relatorio_publico_pdf(request):
    offer_name = (request.GET.get("offer") or "Oferta programada").strip() or "Oferta programada"
    booklet_name = (request.GET.get("booklet") or "Avaliacao Diagnostica").strip() or "Avaliacao Diagnostica"
    school_name = (request.GET.get("school") or "EEMTI Dom Jose Tupinamba da Frota").strip() or "EEMTI Dom Jose Tupinamba da Frota"
    serie_label = (request.GET.get("serie_label") or "1a serie").strip() or "1a serie"
    payload = {
        "students_total": 3,
        "absent_count": 1,
        "finalized_count": 2,
        "in_progress_count": 1,
        "items_total": 5,
        "accuracy_buckets": [
            {"range": "0-25", "count_students": 1, "pct_students": 33.33},
            {"range": "25-50", "count_students": 0, "pct_students": 0.0},
            {"range": "50-75", "count_students": 1, "pct_students": 33.33},
            {"range": "75-100", "count_students": 1, "pct_students": 33.33},
        ],
        "students": [],
        "items": [],
    }
    return _render_report_pdf_response(
        request,
        report_title="RELATORIO DA OFERTA",
        offer_name=offer_name,
        booklet_name=booklet_name,
        school_label=school_name,
        serie_label=serie_label,
        class_label="-",
        period_label="04/03/2026 - 14/03/2026",
        payload=payload,
        disposition="inline",
        filename="relatorio-preview.pdf",
    )


def _build_report_pdf_context(
    *,
    report_title,
    offer_name,
    booklet_name,
    school_label,
    serie_label,
    class_label,
    period_label,
    generated_at,
    payload,
):
    total_students = max(int(payload.get("students_total", 0) or 0), 0)
    finalized_count = max(int(payload.get("finalized_count", 0) or 0), 0)
    absent_count = max(int(payload.get("absent_count", 0) or 0), 0)
    not_finalized_count = max(total_students - finalized_count, 0)
    denominator = max(total_students, 1)
    finalized_pct = round((finalized_count / denominator) * 100, 2)
    not_finalized_pct = round((not_finalized_count / denominator) * 100, 2)
    circumference = round(2 * 3.141592653589793 * 72, 2)
    finalized_stroke = round((finalized_pct / 100) * circumference, 2)
    not_finalized_stroke = round(max(circumference - finalized_stroke, 0), 2)

    tones = ["red", "yellow", "green", "blue"]
    accuracy_buckets = []
    for index, bucket in enumerate(payload.get("accuracy_buckets", [])):
        accuracy_buckets.append(
            {
                "range": bucket["range"],
                "pct_students": bucket["pct_students"],
                "tone": tones[index % len(tones)],
            }
        )

    return {
        "report_title": report_title,
        "offer": {"name": offer_name},
        "booklet_name": booklet_name,
        "school_label": school_label,
        "serie_label": serie_label,
        "class_label": class_label,
        "period_label": period_label,
        "generated_at": generated_at,
        "payload": payload,
        "chart": {
            "circumference": circumference,
            "finalized_stroke": finalized_stroke,
            "not_finalized_stroke": not_finalized_stroke,
            "finalized_pct": finalized_pct,
            "not_finalized_pct": not_finalized_pct,
            "not_finalized_count": not_finalized_count,
            "absent_count": absent_count,
        },
        "accuracy_buckets": accuracy_buckets,
    }


def _render_report_pdf_response(
    request,
    *,
    report_title,
    offer_name,
    booklet_name,
    school_label,
    serie_label,
    class_label,
    period_label,
    payload,
    disposition,
    filename,
):
    generated_at = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    context = _build_report_pdf_context(
        report_title=report_title,
        offer_name=offer_name,
        booklet_name=booklet_name,
        school_label=school_label,
        serie_label=serie_label,
        class_label=class_label,
        period_label=period_label,
        generated_at=generated_at,
        payload=payload,
    )
    html_string = render_to_string("pdf/report.html", context)
    css_path = str(settings.BASE_DIR / "banco" / "templates" / "pdf" / "pdf.css")
    font_config = FontConfiguration()
    pdf_bytes = HTML(
        string=html_string,
        base_url=request.build_absolute_uri("/"),
    ).write_pdf(
        stylesheets=[CSS(filename=css_path, font_config=font_config)],
        font_config=font_config,
    )

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'{disposition}; filename="{filename}"'
    return response


def _build_offer_report_students_pdf_response(
    request,
    *,
    offer,
    class_ref=None,
    school_ref=None,
    serie=None,
    disposition="attachment",
    filename=None,
):
    payload = _resolve_report_data(
        request,
        offer,
        class_ref=class_ref,
        school_ref=school_ref,
        serie=serie,
    )

    title = offer.description or f"Oferta #{offer.id}"
    lines = [
        f"Relatorio por aluno - {title}",
        f"Caderno: {offer.booklet.name if offer.booklet else f'Caderno #{offer.booklet_id}'}",
        f"Gerado em: {timezone.localtime().strftime('%d/%m/%Y %H:%M')}",
    ]
    if class_ref is not None:
        lines.append(f"Turma filtrada: {class_ref}")
    if school_ref is not None:
        lines.append(f"Escola filtrada: {school_ref}")
    if serie is not None:
        lines.append(f"Serie filtrada: {serie}")
    lines.extend(
        [
            f"Total de alunos: {payload['students_total']}",
            f"Ausentes: {payload['absent_count']}",
            f"Finalizados: {payload['finalized_count']}",
            "",
        ]
    )

    if payload["students"]:
        for row in payload["students"]:
            lines.append(
                (
                    f"Aluno {row['student_ref']} - {row['name']} | Turma {row['class_ref']} | "
                    f"Acertos {row['correct']} | Erros {row['wrong']} | "
                    f"Brancos {row['blank']} | Total {row['total']} | "
                    f"% Acerto {row['correct_pct']} | Status {row['status']}"
                )
            )
    else:
        lines.append("Nenhum aluno encontrado para o filtro selecionado.")

    resolved_filename = filename or f"oferta-{offer.id}-relatorio-alunos.pdf"
    response = HttpResponse(_build_simple_pdf(lines), content_type="application/pdf")
    response["Content-Disposition"] = f'{disposition}; filename="{resolved_filename}"'
    return response


def _build_offer_report_items_pdf_response(
    request,
    *,
    offer,
    class_ref=None,
    school_ref=None,
    serie=None,
    disposition="attachment",
    filename=None,
):
    payload = _resolve_report_data(
        request,
        offer,
        class_ref=class_ref,
        school_ref=school_ref,
        serie=serie,
    )

    title = offer.description or f"Oferta #{offer.id}"
    lines = [
        f"Relatorio por questao - {title}",
        f"Caderno: {offer.booklet.name if offer.booklet else f'Caderno #{offer.booklet_id}'}",
        f"Gerado em: {timezone.localtime().strftime('%d/%m/%Y %H:%M')}",
    ]
    if class_ref is not None:
        lines.append(f"Turma filtrada: {class_ref}")
    if school_ref is not None:
        lines.append(f"Escola filtrada: {school_ref}")
    if serie is not None:
        lines.append(f"Serie filtrada: {serie}")
    lines.extend(
        [
            f"Total de questoes: {payload['items_total']}",
            "",
        ]
    )

    if payload["items"]:
        for row in payload["items"]:
            lines.append(
                (
                    f"Questao {row['order']} | % Acerto {row['correct_pct']} | "
                    f"% Erro {row['wrong_pct']} | % Branco {row['blank_pct']} | "
                    f"Mais marcada {row['most_marked_option'] or '-'} | "
                    f"Respondidas {row['total_answered']}"
                )
            )
    else:
        lines.append("Nenhuma questao encontrada para o filtro selecionado.")

    resolved_filename = filename or f"oferta-{offer.id}-relatorio-questoes.pdf"
    response = HttpResponse(_build_simple_pdf(lines), content_type="application/pdf")
    response["Content-Disposition"] = f'{disposition}; filename="{resolved_filename}"'
    return response


def _build_offer_report_export_payload(request, offer, *, class_ref=None, school_ref=None, serie=None):
    return _resolve_report_data(
        request,
        offer,
        class_ref=class_ref,
        school_ref=school_ref,
        serie=serie,
    )


def _build_offer_report_export_csv_response(offer, payload):
    output = StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(["secao", "campo", "valor"])
    writer.writerow(["resumo", "oferta", offer.description or f"Oferta #{offer.id}"])
    writer.writerow(["resumo", "caderno", offer.booklet.name if offer.booklet else f"Caderno #{offer.booklet_id}"])
    writer.writerow(["resumo", "gerado_em", timezone.localtime().strftime("%d/%m/%Y %H:%M")])
    writer.writerow(["resumo", "total_alunos", payload["students_total"]])
    writer.writerow(["resumo", "ausentes", payload["absent_count"]])
    writer.writerow(["resumo", "finalizados", payload["finalized_count"]])
    writer.writerow([])
    writer.writerow(["alunos", "student_ref", "name", "class_ref", "correct", "wrong", "blank", "total", "correct_pct", "status"])
    for row in payload["students"]:
        writer.writerow(
            [
                "alunos",
                row["student_ref"],
                row["name"],
                row["class_ref"],
                row["correct"],
                row["wrong"],
                row["blank"],
                row["total"],
                row["correct_pct"],
                row["status"],
            ]
        )
    writer.writerow([])
    writer.writerow(
        [
            "questoes",
            "order",
            "booklet_item_id",
            "question_id",
            "subject_name",
            "correct_pct",
            "wrong_pct",
            "blank_pct",
            "most_marked_option",
            "total_answered",
        ]
    )
    for row in payload["items"]:
        writer.writerow(
            [
                "questoes",
                row["order"],
                row["booklet_item_id"],
                row["question_id"],
                row["subject_name"] or "",
                row["correct_pct"],
                row["wrong_pct"],
                row["blank_pct"],
                row["most_marked_option"] or "",
                row["total_answered"],
            ]
        )

    response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="oferta-{offer.id}-relatorio.csv"'
    return response


def _build_offer_report_export_excel_response(offer, payload):
    generated_at = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    summary_rows = [
        ("Oferta", offer.description or f"Oferta #{offer.id}"),
        ("Caderno", offer.booklet.name if offer.booklet else f"Caderno #{offer.booklet_id}"),
        ("Gerado em", generated_at),
        ("Total de alunos", payload["students_total"]),
        ("Ausentes", payload["absent_count"]),
        ("Finalizados", payload["finalized_count"]),
    ]
    html_string = [
        "<html><head><meta charset='utf-8'></head><body>",
        "<table border='1'>",
        "<tr><th colspan='2'>Resumo</th></tr>",
    ]
    for label, value in summary_rows:
        html_string.append(f"<tr><td>{escape(str(label))}</td><td>{escape(str(value))}</td></tr>")
    html_string.extend(
        [
            "</table><br/>",
            "<table border='1'>",
            "<tr><th colspan='9'>Alunos</th></tr>",
            "<tr><th>student_ref</th><th>name</th><th>class_ref</th><th>correct</th><th>wrong</th><th>blank</th><th>total</th><th>correct_pct</th><th>status</th></tr>",
        ]
    )
    for row in payload["students"]:
        html_string.append(
            "<tr>"
            f"<td>{escape(str(row['student_ref']))}</td>"
            f"<td>{escape(str(row['name']))}</td>"
            f"<td>{escape(str(row['class_ref']))}</td>"
            f"<td>{escape(str(row['correct']))}</td>"
            f"<td>{escape(str(row['wrong']))}</td>"
            f"<td>{escape(str(row['blank']))}</td>"
            f"<td>{escape(str(row['total']))}</td>"
            f"<td>{escape(str(row['correct_pct']))}</td>"
            f"<td>{escape(str(row['status']))}</td>"
            "</tr>"
        )
    html_string.extend(
        [
            "</table><br/>",
            "<table border='1'>",
            "<tr><th colspan='9'>Questoes</th></tr>",
            "<tr><th>order</th><th>booklet_item_id</th><th>question_id</th><th>subject_name</th><th>correct_pct</th><th>wrong_pct</th><th>blank_pct</th><th>most_marked_option</th><th>total_answered</th></tr>",
        ]
    )
    for row in payload["items"]:
        html_string.append(
            "<tr>"
            f"<td>{escape(str(row['order']))}</td>"
            f"<td>{escape(str(row['booklet_item_id']))}</td>"
            f"<td>{escape(str(row['question_id']))}</td>"
            f"<td>{escape(str(row['subject_name'] or ''))}</td>"
            f"<td>{escape(str(row['correct_pct']))}</td>"
            f"<td>{escape(str(row['wrong_pct']))}</td>"
            f"<td>{escape(str(row['blank_pct']))}</td>"
            f"<td>{escape(str(row['most_marked_option'] or ''))}</td>"
            f"<td>{escape(str(row['total_answered']))}</td>"
            "</tr>"
        )
    html_string.append("</table></body></html>")

    response = HttpResponse(
        "".join(html_string),
        content_type="application/vnd.ms-excel; charset=utf-8",
    )
    response["Content-Disposition"] = f'attachment; filename="oferta-{offer.id}-relatorio.xls"'
    return response


def _build_offer_report_export_pdf_response(request, offer, *, class_ref=None, school_ref=None, serie=None):
    payload = _build_offer_report_export_payload(
        request,
        offer,
        class_ref=class_ref,
        school_ref=school_ref,
        serie=serie,
    )
    school_label = (request.query_params.get("school_label") or "").strip() or (str(school_ref) if school_ref is not None else "Todas")
    serie_label = (request.query_params.get("serie_label") or "").strip() or (f"{serie}a serie" if serie is not None else "Todas")
    class_label = (request.query_params.get("class_name") or "").strip() or (f"Turma {class_ref}" if class_ref is not None else "-")
    period_label = f"{offer.start_date.strftime('%d/%m/%Y')} - {offer.end_date.strftime('%d/%m/%Y')}"
    return _render_report_pdf_response(
        request,
        report_title="RELATORIO DA TURMA" if class_ref is not None else "RELATORIO DA OFERTA",
        offer_name=class_label if class_ref is not None else (offer.description or f"Oferta #{offer.id}"),
        booklet_name=offer.booklet.name if offer.booklet else f"Caderno #{offer.booklet_id}",
        school_label=school_label,
        serie_label=serie_label,
        class_label=class_label,
        period_label=period_label,
        payload=payload,
        disposition="attachment",
        filename=f"oferta-{offer.id}-relatorio.pdf",
    )


class ReportPdfPreviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        class_ref = _parse_class_ref(request.query_params.get("class_ref"))
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        kind = (request.query_params.get("kind") or "students").strip().lower()

        if kind == "students":
            return _build_offer_report_students_pdf_response(
                request,
                offer=offer,
                class_ref=class_ref,
                school_ref=school_ref,
                serie=serie,
                disposition="inline",
                filename=f"oferta-{offer.id}-relatorio-alunos-preview.pdf",
            )
        if kind == "items":
            return _build_offer_report_items_pdf_response(
                request,
                offer=offer,
                class_ref=class_ref,
                school_ref=school_ref,
                serie=serie,
                disposition="inline",
                filename=f"oferta-{offer.id}-relatorio-questoes-preview.pdf",
            )

        raise ValidationError({"kind": "Use 'students' ou 'items'."})


class OfferReportSummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        class_ref = _parse_class_ref(request.query_params.get("class_ref"))
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        payload = _resolve_report_data(
            request,
            offer,
            class_ref=class_ref,
            school_ref=school_ref,
            serie=serie,
        )
        return Response(payload, status=status.HTTP_200_OK)


class ReportsOverviewView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        offers_qs = Offer.objects.filter(deleted=False)
        if not request.user.is_superuser:
            offers_qs = offers_qs.filter(created_by=request.user.id)
        offers = list(offers_qs.select_related("booklet").order_by("-created_at"))

        today = timezone.localdate()
        offers_active = sum(1 for offer in offers if offer.start_date <= today <= offer.end_date)
        offers_closed = sum(1 for offer in offers if offer.end_date < today)

        offer_ids = [offer.id for offer in offers]
        applications_qs = Application.objects.filter(offer_id__in=offer_ids)
        applications = list(applications_qs.select_related("offer", "offer__booklet"))
        application_ids = [application.id for application in applications]

        answered_application_ids = set(
            StudentAnswer.objects.filter(application_id__in=application_ids)
            .exclude(selected_option__isnull=True)
            .exclude(selected_option="")
            .values_list("application_id", flat=True)
            .distinct()
        )
        answered_total = len(answered_application_ids)

        finalized_total = sum(
            1
            for application in applications
            if bool(application.finalized_at)
            or (
                application.id in answered_application_ids
                and application.offer.booklet.items.count() > 0
                and application.answers.exclude(selected_option__isnull=True).exclude(selected_option="").count()
                >= application.offer.booklet.items.count()
            )
        )
        absent_total = sum(1 for application in applications if application.student_absent)

        applications_total = len(applications)
        finalization_rate_pct = round((finalized_total / applications_total) * 100, 2) if applications_total else 0.0

        offer_metrics = {}
        offer_answered = {}
        for application in applications:
            current = offer_metrics.setdefault(
                application.offer_id,
                {"total": 0, "finalized": 0, "label": application.offer.description or f"Oferta #{application.offer_id}"},
            )
            current["total"] += 1
            if application.id in answered_application_ids:
                offer_answered.setdefault(application.offer_id, 0)
                offer_answered[application.offer_id] += 1
            if application.finalized_at:
                current["finalized"] += 1

        top_offers_finalization = []
        for offer_id, metrics in offer_metrics.items():
            total = metrics["total"]
            finalized = metrics["finalized"]
            pct = round((finalized / total) * 100, 2) if total else 0.0
            top_offers_finalization.append(
                {
                    "offer_id": offer_id,
                    "label": metrics["label"],
                    "finalized_pct": pct,
                }
            )
        top_offers_finalization = sorted(
            top_offers_finalization,
            key=lambda row: (row["finalized_pct"], row["offer_id"]),
            reverse=True,
        )[:5]

        accuracy_buckets_counts = {
            "0-25": 0,
            "25-50": 0,
            "50-75": 0,
            "75-100": 0,
        }
        considered_students = 0
        for application in applications:
            offer = application.offer
            items_total = offer.booklet.items.count()
            if items_total <= 0 or application.student_absent:
                continue
            answers_qs = application.answers.exclude(selected_option__isnull=True).exclude(selected_option="")
            answered = list(answers_qs)
            if not answered:
                continue
            considered_students += 1
            correct = sum(1 for answer in answered if answer.is_correct)
            pct = (correct / items_total) * 100
            if pct <= 25:
                accuracy_buckets_counts["0-25"] += 1
            elif pct <= 50:
                accuracy_buckets_counts["25-50"] += 1
            elif pct <= 75:
                accuracy_buckets_counts["50-75"] += 1
            else:
                accuracy_buckets_counts["75-100"] += 1

        denominator = max(considered_students, 1)
        accuracy_buckets_overall = [
            {
                "range": key,
                "pct_students": round((value / denominator) * 100, 2),
                "count_students": value,
            }
            for key, value in accuracy_buckets_counts.items()
        ]

        recent_offers = []
        for offer in offers[:5]:
            recent_offers.append(
                {
                    "offer_id": offer.id,
                    "label": offer.description or f"Oferta #{offer.id}",
                    "booklet_name": offer.booklet.name if offer.booklet else f"Caderno #{offer.booklet_id}",
                    "start_date": offer.start_date,
                    "end_date": offer.end_date,
                    "created_at": offer.created_at,
                }
            )

        return Response(
            {
                "offers_active": offers_active,
                "offers_closed": offers_closed,
                "offers_total": len(offers),
                "applications_total": applications_total,
                "answered_total": answered_total,
                "finalized_total": finalized_total,
                "absent_total": absent_total,
                "finalization_rate_pct": finalization_rate_pct,
                "top_offers_finalization": top_offers_finalization,
                "accuracy_buckets_overall": accuracy_buckets_overall,
                "recent_offers": recent_offers,
            },
            status=status.HTTP_200_OK,
        )


class ReportsByClassView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        items_total = offer.booklet.items.count()
        applications_qs = Application.objects.filter(offer=offer)
        if school_ref is not None or serie is not None:
            filtered_class_refs = _resolve_filtered_class_refs(
                request,
                school_ref=school_ref,
                serie=serie,
            )
            applications_qs = applications_qs.filter(class_ref__in=filtered_class_refs)

        applications = list(
            applications_qs.order_by("class_ref", "student_ref", "id").prefetch_related(
                Prefetch(
                    "answers",
                    queryset=StudentAnswer.objects.only(
                        "id",
                        "application_id",
                        "booklet_item_id",
                        "selected_option",
                        "is_correct",
                    ),
                )
            )
        )
        class_names = _build_class_names_map(request)

        grouped = {}
        for application in applications:
            class_id = int(application.class_ref)
            if class_id not in grouped:
                grouped[class_id] = {
                    "class_id": class_id,
                    "class_name": class_names.get(class_id, f"Turma {class_id}"),
                    "total_students": 0,
                    "correct_sum": 0,
                    "absent_count": 0,
                }

            row = grouped[class_id]
            row["total_students"] += 1

            selected_answers = [
                answer
                for answer in application.answers.all()
                if str(answer.selected_option or "").strip()
            ]
            if not selected_answers:
                row["absent_count"] += 1

            row["correct_sum"] += sum(1 for answer in selected_answers if answer.is_correct)

        payload = []
        for class_id in sorted(grouped.keys()):
            row = grouped[class_id]
            total_students = int(row["total_students"])
            denominator = total_students * items_total
            accuracy_percent = round((row["correct_sum"] / denominator) * 100, 2) if denominator > 0 else 0.0
            absent_percent = round((row["absent_count"] / total_students) * 100, 2) if total_students > 0 else 0.0
            payload.append(
                {
                    "class_id": class_id,
                    "class_name": row["class_name"],
                    "total_students": total_students,
                    "accuracy_percent": accuracy_percent,
                    "absent_count": int(row["absent_count"]),
                    "absent_percent": absent_percent,
                }
            )

        serializer = ReportByClassRowSerializer(payload, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class OfferReportStudentsCsvView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        class_ref = _parse_class_ref(request.query_params.get("class_ref"))
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        payload = _resolve_report_data(
            request,
            offer,
            class_ref=class_ref,
            school_ref=school_ref,
            serie=serie,
        )

        return _build_csv_response(
            filename=f"oferta-{offer.id}-relatorio-alunos.csv",
            header=[
                "student_ref",
                "name",
                "class_ref",
                "correct",
                "wrong",
                "blank",
                "total",
                "correct_pct",
                "status",
            ],
            rows=[
                [
                    row["student_ref"],
                    row["name"],
                    row["class_ref"],
                    row["correct"],
                    row["wrong"],
                    row["blank"],
                    row["total"],
                    row["correct_pct"],
                    row["status"],
                ]
                for row in payload["students"]
            ],
        )


class OfferReportExportCsvView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        class_ref = _parse_class_ref(request.query_params.get("class_ref"))
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        payload = _build_offer_report_export_payload(
            request,
            offer,
            class_ref=class_ref,
            school_ref=school_ref,
            serie=serie,
        )
        return _build_offer_report_export_csv_response(offer, payload)


class OfferReportExportExcelView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        class_ref = _parse_class_ref(request.query_params.get("class_ref"))
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        payload = _build_offer_report_export_payload(
            request,
            offer,
            class_ref=class_ref,
            school_ref=school_ref,
            serie=serie,
        )
        return _build_offer_report_export_excel_response(offer, payload)


class OfferReportExportPdfView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        class_ref = _parse_class_ref(request.query_params.get("class_ref"))
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        return _build_offer_report_export_pdf_response(
            request,
            offer,
            class_ref=class_ref,
            school_ref=school_ref,
            serie=serie,
        )


class OfferReportStudentsPdfView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        class_ref = _parse_class_ref(request.query_params.get("class_ref"))
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        return _build_offer_report_students_pdf_response(
            request,
            offer=offer,
            class_ref=class_ref,
            school_ref=school_ref,
            serie=serie,
        )


class OfferReportItemsCsvView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        class_ref = _parse_class_ref(request.query_params.get("class_ref"))
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        payload = _resolve_report_data(
            request,
            offer,
            class_ref=class_ref,
            school_ref=school_ref,
            serie=serie,
        )

        return _build_csv_response(
            filename=f"oferta-{offer.id}-relatorio-questoes.csv",
            header=[
                "order",
                "booklet_item_id",
                "question_id",
                "subject_name",
                "correct_pct",
                "wrong_pct",
                "blank_pct",
                "most_marked_option",
                "total_answered",
                "question_detail_url",
            ],
            rows=[
                [
                    row["order"],
                    row["booklet_item_id"],
                    row["question_id"],
                    row["subject_name"] or "",
                    row["correct_pct"],
                    row["wrong_pct"],
                    row["blank_pct"],
                    row["most_marked_option"] or "",
                    row["total_answered"],
                    row["question_detail_url"] or "",
                ]
                for row in payload["items"]
            ],
        )


class OfferReportItemsPdfView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, offer_id):
        offer = _get_offer_for_reports(request, offer_id)
        class_ref = _parse_class_ref(request.query_params.get("class_ref"))
        school_ref = _parse_school_ref(request.query_params.get("school_ref"))
        serie = _parse_serie(request.query_params.get("serie"))
        return _build_offer_report_items_pdf_response(
            request,
            offer=offer,
            class_ref=class_ref,
            school_ref=school_ref,
            serie=serie,
        )
