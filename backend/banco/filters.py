import django_filters as df
from .models import Question


class QuestionFilter(df.FilterSet):
    id = df.NumberFilter(field_name="id")
    created_by = df.NumberFilter(field_name="created_by")
    visibility = df.CharFilter(method="filter_visibility")
    mine = df.BooleanFilter(method="filter_mine")
    public_pool = df.BooleanFilter(method="filter_public_pool")

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
        fields = [
            "id",
            "private",
            "deleted",
            "created_by",
            "visibility",
            "mine",
            "public_pool",
        ]

    def filter_visibility(self, queryset, name, value):
        if value is None:
            return queryset

        visibility = str(value).strip().lower()
        if visibility == "public":
            return queryset.filter(private=False)
        if visibility == "private":
            return queryset.filter(private=True)
        return queryset

    def filter_mine(self, queryset, name, value):
        if not value:
            return queryset

        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return queryset.none()
        return queryset.filter(created_by=user.id)

    def filter_public_pool(self, queryset, name, value):
        if not value:
            return queryset

        user = getattr(self.request, "user", None)
        if not user or not user.is_authenticated:
            return queryset.none()
        return queryset.filter(private=False).exclude(created_by=user.id)
