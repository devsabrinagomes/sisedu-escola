from django.db.models import Q
from django.utils import timezone
from datetime import datetime
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser

from .models import Disciplina, Questao, Saber, Habilidade
from .serializers import (
    DisciplinaSerializer,
    QuestaoSerializer,
    SaberSerializer,
    HabilidadeSerializer,
)
from .permissions import IsOwnerOrReadOnly

class DisciplinaViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Disciplina.objects.all().order_by("nome")
    serializer_class = DisciplinaSerializer
    permission_classes = [IsAuthenticated]


class SaberViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SaberSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Saber.objects.select_related("disciplina").all().order_by("codigo", "titulo")
        disciplina_id = self.request.query_params.get("disciplina")
        return qs.filter(disciplina_id=disciplina_id) if disciplina_id else qs


class HabilidadeViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = HabilidadeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = Habilidade.objects.select_related("saber", "saber__disciplina").all().order_by("codigo", "titulo")
        saber_id = self.request.query_params.get("saber")
        return qs.filter(saber_id=saber_id) if saber_id else qs


class QuestaoViewSet(viewsets.ModelViewSet):
    serializer_class = QuestaoSerializer
    permission_classes = [IsAuthenticated, IsOwnerOrReadOnly]
    parser_classes = [MultiPartParser, FormParser]

    def get_queryset(self):
        user = self.request.user
        params = self.request.query_params

        qs = Questao.objects.select_related("disciplina", "saber", "habilidade", "created_by")

        # regra de visibilidade (já tinha)
        if not user.is_superuser:
            qs = qs.filter(Q(is_private=False) | Q(created_by=user))

        # -------- BUSCA (frontend manda ?search=...) --------
        search = (params.get("search") or "").strip()
        if search:
            ids = set()
            
            base_q = (
                Q(enunciado_html__icontains=search)
                | Q(comando_html__icontains=search)
                | Q(texto_suporte_html__icontains=search)
                | Q(disciplina__nome__icontains=search)
                | Q(created_by__username__icontains=search)
                | Q(created_by__first_name__icontains=search)
                | Q(created_by__last_name__icontains=search)
            )
            ids.update(qs.filter(base_q).values_list("id", flat=True))
            
            if search.isdigit():
                ids.add(int(search))
            
            ids.update(qs.filter(saber__codigo__icontains=search).values_list("id", flat=True))
            ids.update(qs.filter(saber__titulo__icontains=search).values_list("id", flat=True))
            ids.update(qs.filter(habilidade__codigo__icontains=search).values_list("id", flat=True))
            ids.update(qs.filter(habilidade__titulo__icontains=search).values_list("id", flat=True))

            qs = qs.filter(id__in=ids)

        # -------- FILTRO DISCIPLINA (frontend manda ?disciplina=ID) --------
        disciplina_id = params.get("disciplina")
        if disciplina_id and disciplina_id != "todos":
            qs = qs.filter(disciplina_id=disciplina_id)

        # -------- FILTROS DE DATA (iguais aos params do teu frontend) --------
        created_at_date = params.get("created_at__date")
        if created_at_date:
            qs = qs.filter(created_at__date=created_at_date)

        created_at_gte = params.get("created_at__gte")
        if created_at_gte:
            qs = qs.filter(created_at__date__gte=created_at_gte)

        created_at_year = params.get("created_at__year")
        if created_at_year:
            qs = qs.filter(created_at__year=created_at_year)

        created_at_month = params.get("created_at__month")
        if created_at_month:
            qs = qs.filter(created_at__month=created_at_month)

        # -------- ORDENAÇÃO (frontend manda ?ordering=campo ou -campo) --------
        ordering = params.get("ordering") or "-created_at"

        allowed = {
            "id",
            "created_at",
            "is_private",
            "created_by__username",
            "disciplina__nome",
            "enunciado_html",
        }
        ord_field = ordering.lstrip("-")
        if ord_field in allowed:
            qs = qs.order_by(ordering)
        else:
            qs = qs.order_by("-created_at")

        return qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)
