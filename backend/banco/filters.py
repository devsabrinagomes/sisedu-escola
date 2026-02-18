import django_filters as df
from .models import Questao

class QuestaoFilter(df.FilterSet):
    created_by = df.CharFilter(field_name="created_by__username", lookup_expr="iexact")
    created_at__date = df.DateFilter(field_name="created_at", lookup_expr="date")
    created_at__gte = df.DateFilter(field_name="created_at", lookup_expr="date__gte")
    created_at__year = df.NumberFilter(field_name="created_at", lookup_expr="year")
    created_at__month = df.NumberFilter(field_name="created_at", lookup_expr="month")

    class Meta:
        model = Questao
        fields = ["disciplina", "is_private"]
