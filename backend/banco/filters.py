import django_filters as df
from .models import Question


class QuestionFilter(df.FilterSet):
    created_by = df.NumberFilter(field_name="created_by")

    created_at__date = df.DateFilter(
        field_name="created_at",
        lookup_expr="date"
    )

    created_at__gte = df.DateFilter(
        field_name="created_at",
        lookup_expr="date__gte"
    )

    created_at__year = df.NumberFilter(
        field_name="created_at",
        lookup_expr="year"
    )

    created_at__month = df.NumberFilter(
        field_name="created_at",
        lookup_expr="month"
    )

    private = df.BooleanFilter(field_name="private")
    deleted = df.BooleanFilter(field_name="deleted")

    subject = df.NumberFilter(
        field_name="versions__subject_id"
    )

    skill = df.NumberFilter(
        field_name="versions__skill_id"
    )

    descriptor = df.NumberFilter(
        field_name="versions__descriptor_id"
    )

    class Meta:
        model = Question
        fields = ["private", "deleted"]
