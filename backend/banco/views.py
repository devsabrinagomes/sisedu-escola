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


class OfferKitPdfView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_offer(self, request, offer_id):
        offer = get_object_or_404(Offer.objects.select_related("booklet"), id=offer_id, deleted=False)
        if not request.user.is_superuser and offer.created_by != request.user.id:
            raise PermissionDenied("Você não tem permissão para baixar o kit desta oferta.")
        return offer

    def get(self, request, offer_id, kind):
        offer = self._get_offer(request, offer_id)
        return _render_booklet_kit_pdf(
            booklet=offer.booklet,
            kind=kind,
            kit_name=offer.description or f"Oferta #{offer.id}",
            filename_prefix=f"oferta-{offer.id}",
        )


class BookletKitPdfView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_booklet(self, request, booklet_id):
        booklet = get_object_or_404(Booklet, id=booklet_id, deleted=False)
        if not request.user.is_superuser and booklet.created_by != request.user.id:
            raise PermissionDenied("Você não tem permissão para baixar o kit deste caderno.")
        return booklet

    def get(self, request, booklet_id, kind):
        booklet = self._get_booklet(request, booklet_id)
        return _render_booklet_kit_pdf(
            booklet=booklet,
            kind=kind,
            kit_name=booklet.name or f"Caderno #{booklet.id}",
            filename_prefix=f"caderno-{booklet.id}",
        )


def _render_booklet_kit_pdf(*, booklet, kind, kit_name, filename_prefix):
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
    base_url = str(settings.BASE_DIR / "banco" / "templates" / "pdf")

    if kind == "prova":
        html_string = render_to_string("pdf/booklet.html", context)
        filename = f"{filename_prefix}-caderno-prova.pdf"
    elif kind == "cartao-resposta":
        html_string = render_to_string("pdf/answer_sheet.html", context)
        filename = f"{filename_prefix}-cartao-resposta.pdf"
    else:
        raise ValidationError({"detail": "Tipo de kit inválido."})

    try:
        pdf_bytes = HTML(string=html_string, base_url=base_url).write_pdf(
            stylesheets=[CSS(filename=css_path)]
        )
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

        output = StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(
            [
                "student_ref",
                "name",
                "class_ref",
                "correct",
                "wrong",
                "blank",
                "total",
                "correct_pct",
                "status",
            ]
        )
        for row in payload["students"]:
            writer.writerow(
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
            )

        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="oferta-{offer.id}-relatorio-alunos.csv"'
        return response


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

        output = StringIO()
        writer = csv.writer(output, delimiter=";")
        writer.writerow(
            [
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
            ]
        )
        for row in payload["items"]:
            writer.writerow(
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
            )

        response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="oferta-{offer.id}-relatorio-questoes.csv"'
        return response


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
