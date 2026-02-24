import json
import os
import time
import unicodedata
from io import StringIO
import csv
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from django.db.models import Max, Prefetch, Q
from django.db import transaction
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .filters import QuestionFilter
from .mixins import OwnerAccessMixin
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
    ReportByClassRowSerializer,
    SkillSerializer,
    StudentAnswersBulkUpsertSerializer,
    SubjectSerializer,
    TopicSerializer,
)


MOCK_SIGE_DATA = {
    "default": {
        "schools": [
            {"school_ref": 1101, "name": "EEMTI Dom José Tupinambá da Frota"},
            {"school_ref": 1102, "name": "EEEP Lysia Pimentel Gomes Sampaio Sales"},
        ],
        "classes_by_school": {
            1101: [
                {"class_ref": 901001, "name": "1º Ano Integral A", "year": 2026},
                {"class_ref": 901002, "name": "1º Ano Integral B", "year": 2026},
            ],
            1102: [
                {"class_ref": 902001, "name": "2º Ano Integral A", "year": 2026},
                {"class_ref": 902002, "name": "3º Ano Integral B", "year": 2026},
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
            {"school_ref": 1201, "name": "EEMTI Governador Adauto Bezerra"},
            {"school_ref": 1202, "name": "EEMTI Dom José Tupinambá da Frota"},
        ],
        "classes_by_school": {
            1201: [
                {"class_ref": 903001, "name": "1º Ano Integral A", "year": 2026},
                {"class_ref": 903002, "name": "1º Ano Integral B", "year": 2026},
            ],
            1202: [
                {"class_ref": 904001, "name": "2º Ano Integral A", "year": 2026},
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


_SIGE_TOKEN_CACHE = {"access_token": None, "expires_at": 0.0}


def _sige_enabled():
    return bool(getattr(settings, "SIGE_ACADEMICO_BASE_URL", "").strip()) and bool(
        getattr(settings, "SIGE_ACADEMICO_TOKEN_URL", "").strip()
    )


def _sige_strip_slash(url):
    return str(url).rstrip("/")


def _sige_fetch_token():
    static_token = str(getattr(settings, "SIGE_ACADEMICO_ACCESS_TOKEN", "") or "").strip()
    if static_token:
        return static_token

    now = time.time()
    if _SIGE_TOKEN_CACHE["access_token"] and now < float(_SIGE_TOKEN_CACHE["expires_at"]):
        return _SIGE_TOKEN_CACHE["access_token"]

    token_url = _sige_strip_slash(getattr(settings, "SIGE_ACADEMICO_TOKEN_URL", ""))
    grant_type = str(getattr(settings, "SIGE_ACADEMICO_GRANT_TYPE", "client_credentials"))
    client_id = str(getattr(settings, "SIGE_ACADEMICO_CLIENT_ID", "") or "")
    client_secret = str(getattr(settings, "SIGE_ACADEMICO_CLIENT_SECRET", "") or "")
    username = str(getattr(settings, "SIGE_ACADEMICO_USERNAME", "") or "")
    password = str(getattr(settings, "SIGE_ACADEMICO_PASSWORD", "") or "")
    scope = str(getattr(settings, "SIGE_ACADEMICO_SCOPE", "") or "")

    payload = {"grant_type": grant_type}
    if client_id:
        payload["client_id"] = client_id
    if client_secret:
        payload["client_secret"] = client_secret
    if username:
        payload["username"] = username
    if password:
        payload["password"] = password
    if scope:
        payload["scope"] = scope

    data = urllib_parse.urlencode(payload).encode("utf-8")
    req = urllib_request.Request(
        token_url,
        data=data,
        method="POST",
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )

    try:
        with urllib_request.urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8")
            body = json.loads(raw or "{}")
    except (urllib_error.URLError, urllib_error.HTTPError, json.JSONDecodeError) as exc:
        raise ValidationError({"detail": f"Falha ao autenticar no SIGE Acadêmico: {exc}"})

    access_token = body.get("access_token")
    if not access_token:
        raise ValidationError({"detail": "Token inválido do SIGE Acadêmico (access_token ausente)."})

    expires_in = int(body.get("expires_in") or 300)
    _SIGE_TOKEN_CACHE["access_token"] = str(access_token)
    _SIGE_TOKEN_CACHE["expires_at"] = now + max(expires_in - 30, 30)
    return _SIGE_TOKEN_CACHE["access_token"]


def _sige_get(path):
    base_url = _sige_strip_slash(getattr(settings, "SIGE_ACADEMICO_BASE_URL", ""))
    if not base_url:
        raise ValidationError({"detail": "SIGE_ACADEMICO_BASE_URL não configurada."})

    token = _sige_fetch_token()
    url = f"{base_url}/{str(path).lstrip('/')}"
    req = urllib_request.Request(
        url,
        method="GET",
        headers={
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        },
    )
    try:
        with urllib_request.urlopen(req, timeout=30) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw or "[]")
    except urllib_error.HTTPError as exc:
        if exc.code == 401:
            _SIGE_TOKEN_CACHE["access_token"] = None
            _SIGE_TOKEN_CACHE["expires_at"] = 0.0
        detail = exc.read().decode("utf-8", errors="ignore") if hasattr(exc, "read") else str(exc)
        raise ValidationError({"detail": f"Erro SIGE Acadêmico ({exc.code}): {detail or 'sem detalhe'}"})
    except (urllib_error.URLError, json.JSONDecodeError) as exc:
        raise ValidationError({"detail": f"Falha ao consumir SIGE Acadêmico: {exc}"})


def _as_list(payload):
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        for key in ("results", "data", "items", "content"):
            value = payload.get(key)
            if isinstance(value, list):
                return value
    return []


def _as_int(value):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return None


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
    elif items_total > 0 and answered_count >= items_total:
        status = "FINALIZED"
    elif answered_count > 0:
        status = "RECOGNIZED"
    else:
        status = "NONE"

    return {
        "correct": correct,
        "wrong": wrong,
        "blank": blank,
        "status": status,
    }


def _is_offer_open(offer):
    today = timezone.localdate()
    return offer.start_date <= today <= offer.end_date


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


def _normalize_ascii(value):
    raw = str(value or "")
    normalized = unicodedata.normalize("NFKD", raw)
    return normalized.encode("ascii", "ignore").decode("ascii")


def _escape_pdf_text(value):
    return str(value).replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _build_simple_pdf(lines):
    safe_lines = [_escape_pdf_text(_normalize_ascii(line)) for line in lines if str(line).strip()]
    if not safe_lines:
        safe_lines = ["Documento sem conteudo"]

    content_parts = ["BT", "/F1 14 Tf", "50 800 Td"]
    for index, line in enumerate(safe_lines):
        if index > 0:
            content_parts.append("0 -24 Td")
        content_parts.append(f"({line}) Tj")
    content_parts.append("ET")

    stream = ("\n".join(content_parts) + "\n").encode("latin-1", errors="ignore")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode("ascii") + stream + b"endstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{idx} 0 obj\n".encode("ascii"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_offset = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("ascii"))
    pdf.extend(b"0000000000 65535 f \n")
    for offset in offsets[1:]:
        pdf.extend(f"{offset:010d} 00000 n \n".encode("ascii"))

    pdf.extend(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n".encode("ascii"))
    pdf.extend(f"startxref\n{xref_offset}\n%%EOF".encode("ascii"))
    return bytes(pdf)


def _build_csv_response(*, filename, header, rows):
    output = StringIO()
    writer = csv.writer(output, delimiter=";")
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)

    response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _parse_class_ref(raw_value):
    if raw_value in (None, ""):
        return None
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        raise ValidationError({"class_ref": "Informe um class_ref válido."})


def _parse_school_ref(raw_value):
    if raw_value in (None, ""):
        return None
    try:
        return int(raw_value)
    except (TypeError, ValueError):
        raise ValidationError({"school_ref": "Informe um school_ref válido."})


def _parse_serie(raw_value):
    if raw_value in (None, ""):
        return None
    try:
        serie = int(raw_value)
    except (TypeError, ValueError):
        raise ValidationError({"serie": "Informe uma série válida."})
    if serie < 1:
        raise ValidationError({"serie": "Informe uma série válida."})
    return serie


def _extract_serie_from_text(value):
    text = str(value or "")
    digits = []
    for char in text:
        if char.isdigit():
            digits.append(char)
        elif digits:
            break
    if not digits:
        return None
    try:
        return int("".join(digits))
    except (TypeError, ValueError):
        return None


def _get_offer_for_reports(request, offer_id):
    offer = get_object_or_404(Offer.objects.select_related("booklet"), id=offer_id, deleted=False)
    if not request.user.is_superuser and offer.created_by != request.user.id:
        raise PermissionDenied("Você não tem permissão para acessar relatórios desta oferta.")
    return offer


def _build_student_names_map(request, class_refs):
    names_map = {}
    data = _get_mock_sige_for_user(request.user)
    students_by_class = data.get("students_by_class", {})
    for class_ref in class_refs:
        students = students_by_class.get(int(class_ref), [])
        for student in students:
            student_ref = _as_int(student.get("student_ref"))
            if student_ref is None:
                continue
            name = str(student.get("name") or "").strip()
            if not name:
                continue
            names_map[(int(class_ref), int(student_ref))] = name
    return names_map


def _build_class_names_map(request):
    names_map = {}
    data = _get_mock_sige_for_user(request.user)
    classes_by_school = data.get("classes_by_school", {})
    for _, classes in classes_by_school.items():
        for class_row in classes:
            class_ref = _as_int(class_row.get("class_ref"))
            if class_ref is None:
                continue
            name = str(class_row.get("name") or "").strip()
            if not name:
                continue
            names_map[int(class_ref)] = name
    return names_map


def _resolve_filtered_class_refs(request, school_ref=None, serie=None):
    data = _get_mock_sige_for_user(request.user)
    classes_by_school = data.get("classes_by_school", {})

    school_refs = [int(school_ref)] if school_ref is not None else [int(ref) for ref in classes_by_school.keys()]
    filtered_refs = set()
    for ref in school_refs:
        for class_row in classes_by_school.get(int(ref), []):
            class_id = _as_int(class_row.get("class_ref"))
            if class_id is None:
                continue
            if serie is not None:
                class_serie = _as_int(class_row.get("serie")) or _extract_serie_from_text(
                    class_row.get("name")
                )
                if class_serie != serie:
                    continue
            filtered_refs.add(int(class_id))
    return filtered_refs


def _resolve_report_data(request, offer, class_ref=None, school_ref=None, serie=None):
    booklet_items = list(
        offer.booklet.items.select_related("question_version", "question_version__subject").order_by("order", "id")
    )
    items_total = len(booklet_items)

    applications_qs = Application.objects.filter(offer=offer).order_by("class_ref", "student_ref", "id")
    if class_ref is not None:
        applications_qs = applications_qs.filter(class_ref=class_ref)
    else:
        filtered_class_refs = _resolve_filtered_class_refs(
            request,
            school_ref=school_ref,
            serie=serie,
        )
        if school_ref is not None or serie is not None:
            applications_qs = applications_qs.filter(class_ref__in=filtered_class_refs)

    answers_prefetch = Prefetch(
        "answers",
        queryset=StudentAnswer.objects.select_related("booklet_item").only(
            "id",
            "application_id",
            "booklet_item_id",
            "selected_option",
            "is_correct",
        ),
    )
    applications = list(applications_qs.prefetch_related(answers_prefetch))

    class_refs = sorted({int(app.class_ref) for app in applications})
    student_name_map = _build_student_names_map(request, class_refs)

    item_rows_map = {
        item.id: {
            "booklet_item_id": item.id,
            "order": item.order,
            "question_id": item.question_version.question_id,
            "subject_name": getattr(getattr(item.question_version, "subject", None), "name", None),
            "correct_count": 0,
            "wrong_count": 0,
            "total_answered": 0,
            "option_counts": {letter: 0 for letter in ("A", "B", "C", "D", "E")},
        }
        for item in booklet_items
    }

    students = []
    distribution_counts = [0 for _ in range(items_total + 1)]
    absent_count = 0
    finalized_count = 0
    in_progress_count = 0
    sum_correct_present = 0
    present_count = 0

    for application in applications:
        answers = list(application.answers.all())
        answered_count = 0
        correct = 0

        for answer in answers:
            selected = str(answer.selected_option or "").strip().upper()
            if not selected:
                continue
            answered_count += 1
            if answer.is_correct:
                correct += 1

            row = item_rows_map.get(answer.booklet_item_id)
            if row is None:
                continue
            row["total_answered"] += 1
            if answer.is_correct:
                row["correct_count"] += 1
            else:
                row["wrong_count"] += 1
            if selected in row["option_counts"]:
                row["option_counts"][selected] += 1

        wrong = max(answered_count - correct, 0)
        blank = max(items_total - answered_count, 0)

        if application.student_absent:
            status_value = "ABSENT"
            absent_count += 1
        elif application.finalized_at:
            status_value = "FINALIZED"
            finalized_count += 1
        elif items_total > 0 and answered_count >= items_total:
            status_value = "FINALIZED"
            finalized_count += 1
        elif answered_count > 0:
            status_value = "RECOGNIZED"
            in_progress_count += 1
        else:
            status_value = "NONE"

        if status_value != "ABSENT":
            present_count += 1
            sum_correct_present += correct
            bucket_index = min(max(correct, 0), items_total)
            distribution_counts[bucket_index] += 1

        students.append(
            {
                "student_ref": int(application.student_ref),
                "name": student_name_map.get(
                    (int(application.class_ref), int(application.student_ref)),
                    f"Aluno {application.student_ref}",
                ),
                "class_ref": int(application.class_ref),
                "correct": correct,
                "wrong": wrong,
                "blank": blank,
                "total": items_total,
                "correct_pct": round((correct / items_total) * 100, 2) if items_total else 0.0,
                "status": status_value,
            }
        )

    students.sort(key=lambda row: (str(row["name"]).lower(), row["student_ref"]))

    item_rows = []
    for item in booklet_items:
        stats = item_rows_map[item.id]
        denominator = present_count
        blank_count = max(denominator - stats["total_answered"], 0)

        most_marked_option = None
        top_count = 0
        for letter in ("A", "B", "C", "D", "E"):
            letter_count = stats["option_counts"][letter]
            if letter_count > top_count:
                top_count = letter_count
                most_marked_option = letter

        item_rows.append(
            {
                "booklet_item_id": item.id,
                "order": item.order,
                "question_id": item.question_version.question_id,
                "subject_name": getattr(getattr(item.question_version, "subject", None), "name", None),
                "correct_pct": round((stats["correct_count"] / denominator) * 100, 2) if denominator else 0.0,
                "wrong_pct": round((stats["wrong_count"] / denominator) * 100, 2) if denominator else 0.0,
                "blank_pct": round((blank_count / denominator) * 100, 2) if denominator else 0.0,
                "most_marked_option": most_marked_option,
                "total_answered": stats["total_answered"],
                "question_detail_url": f"/questoes/{item.question_version.question_id}",
            }
        )

    avg_correct = (sum_correct_present / present_count) if present_count else 0.0
    avg_correct_pct = (avg_correct / items_total * 100) if items_total and present_count else 0.0

    distribution = [
        {"correct": index, "count": count}
        for index, count in enumerate(distribution_counts)
    ]

    bucket_ranges = [
        {"range": "0-25", "count": 0},
        {"range": "25-50", "count": 0},
        {"range": "50-75", "count": 0},
        {"range": "75-100", "count": 0},
    ]
    for row in students:
        if row["status"] == "ABSENT":
            continue
        pct = float(row["correct_pct"])
        if pct <= 25:
            bucket_ranges[0]["count"] += 1
        elif pct <= 50:
            bucket_ranges[1]["count"] += 1
        elif pct <= 75:
            bucket_ranges[2]["count"] += 1
        else:
            bucket_ranges[3]["count"] += 1

    present_or_answered = max(present_count, 1)
    accuracy_buckets = [
        {
            "range": bucket["range"],
            "count_students": int(bucket["count"]),
            "pct_students": round((bucket["count"] / present_or_answered) * 100, 2),
        }
        for bucket in bucket_ranges
    ]

    return {
        "totals": {
            "students_total": len(applications),
            "absent": absent_count,
            "finalized": finalized_count,
            "in_progress": in_progress_count,
        },
        "items_total": items_total,
        "students_total": len(applications),
        "absent_count": absent_count,
        "finalized_count": finalized_count,
        "in_progress_count": in_progress_count,
        "avg_correct": round(avg_correct, 2),
        "avg_correct_pct": round(avg_correct_pct, 2),
        "accuracy_buckets": accuracy_buckets,
        "distribution": distribution,
        "students": students,
        "items": item_rows,
    }
