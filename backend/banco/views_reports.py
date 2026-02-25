from .views_helpers import *  # noqa: F401,F403
from .views_helpers import (
    _build_class_names_map,
    _build_csv_response,
    _get_offer_for_reports,
    _parse_class_ref,
    _parse_school_ref,
    _parse_serie,
    _resolve_filtered_class_refs,
    _resolve_report_data,
)

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
