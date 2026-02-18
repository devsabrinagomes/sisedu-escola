from django.contrib import admin
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.forms.models import BaseInlineFormSet
from django.utils.html import strip_tags, format_html

from .models import (
    Disciplina,
    Saber,
    Habilidade,
    Questao,
    Resposta,
    Caderno,
    Item,
)


@admin.register(Disciplina)
class DisciplinaAdmin(admin.ModelAdmin):
    list_display = ("id", "nome")
    search_fields = ("nome",)


@admin.register(Saber)
class SaberAdmin(admin.ModelAdmin):
    list_display = ("id", "codigo", "titulo", "disciplina")
    list_filter = ("disciplina",)
    search_fields = ("codigo", "titulo", "disciplina__nome")
    ordering = ("disciplina__nome", "codigo", "titulo")


@admin.register(Habilidade)
class HabilidadeAdmin(admin.ModelAdmin):
    list_display = ("id", "codigo", "titulo", "saber", "disciplina")
    list_filter = ("saber__disciplina", "saber")
    search_fields = ("codigo", "titulo", "saber__titulo", "saber__disciplina__nome")
    ordering = ("saber__disciplina__nome", "saber__codigo", "codigo", "titulo")

    @admin.display(description="Disciplina")
    def disciplina(self, obj):
        return obj.saber.disciplina
    

class RespostaInlineFormSet(BaseInlineFormSet):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        if not self.is_bound:
            for i, form in enumerate(self.forms):
                form.instance.ordem = i + 1
                form.initial["ordem"] = i + 1

    def clean(self):
        super().clean()

        corretas = 0
        total_preenchidas = 0

        for form in self.forms:
            if not getattr(form, "cleaned_data", None):
                continue

            texto = (form.cleaned_data.get("texto_html") or "").strip()
            imagem = form.cleaned_data.get("imagem")
            marcada_correta = form.cleaned_data.get("correta")

            preenchida = bool(texto) or bool(imagem)

            if preenchida:
                total_preenchidas += 1
                if marcada_correta:
                    corretas += 1
            else:
                if marcada_correta:
                    raise ValidationError("Não dá pra marcar como correta uma alternativa vazia.")

        if total_preenchidas < 2:
            raise ValidationError("A questão precisa ter no mínimo 2 alternativas preenchidas.")
        if total_preenchidas > 5:
            raise ValidationError("A questão pode ter no máximo 5 alternativas preenchidas.")
        if corretas != 1:
            raise ValidationError("Marque exatamente 1 alternativa correta (entre as preenchidas).")


class RespostaInline(admin.TabularInline):
    model = Resposta
    formset = RespostaInlineFormSet

    can_delete = False

    extra = 5
    min_num = 5
    max_num = 5
    validate_min = True
    validate_max = True

    fields = ("alternativa_label", "texto_html", "imagem", "correta")
    readonly_fields = ("alternativa_label",)
    ordering = ("ordem",)

    @admin.display(description="Alternativa")
    def alternativa_label(self, obj):
        # quando ainda não tem ordem (antes de salvar)
        if getattr(obj, "ordem", None):
            return chr(ord("A") + obj.ordem - 1)
        return "-"
    
    
@admin.register(Questao)
class QuestaoAdmin(admin.ModelAdmin):
    inlines = [RespostaInline]

    list_display = (
        "id",
        "enunciado_link",
        "disciplina",
        "saber",
        "habilidade",
        "is_private",
        "created_by",
        "created_at",
    )

    list_filter = (
        "disciplina",
        "saber",
        "habilidade",
        "is_private",
        "created_by",
        ("created_at", admin.DateFieldListFilter),
    )

    search_fields = (
        "enunciado_html",
        "texto_suporte_html",
        "created_by__username",
        "created_by__first_name",
        "created_by__last_name",
        "created_by__email",
    )

    ordering = ("-created_at",)
    list_per_page = 25
    list_display_links = ("id",)
    exclude = ("excluida",)

    @admin.display(description="Enunciado")
    def enunciado_link(self, obj):
        texto = strip_tags(obj.enunciado_html or "").replace("\n", " ").strip()
        resumo = (texto[:90] + "…") if len(texto) > 90 else texto
        return format_html('<a href="{}">{}</a>', f"{obj.id}/change/", resumo)

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(Q(is_private=False) | Q(created_by=request.user))

    def get_readonly_fields(self, request, obj=None):
        if obj is None:
            return ()
        return ("created_at",)

    def get_fields(self, request, obj=None):
        fields = list(super().get_fields(request, obj))

        for f in ("created_by", "created_at", "excluida"):
            if f in fields:
                fields.remove(f)
        
        if "is_private" in fields:
            fields.remove("is_private")

            anchor = None
            for a in ("habilidade", "saber", "disciplina"):
                if a in fields:
                    anchor = a
                    break

            if anchor:
                idx = fields.index(anchor) + 1
                fields.insert(idx, "is_private")
            else:
                fields.insert(0, "is_private")
                
        if obj is not None:
            fields.append("created_at")

        return fields

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)

    def save_formset(self, request, form, formset, change):
        instances = formset.save(commit=False)

        ordem = 1
        for obj in instances:
            texto = (obj.texto_html or "").strip()
            preenchida = bool(texto) or bool(obj.imagem)

            if not preenchida:
                if obj.pk:
                    obj.delete()
                continue

            obj.ordem = ordem
            obj.save()
            ordem += 1

        formset.save_m2m()


class ItemInline(admin.TabularInline):
    model = Item
    extra = 0
    fields = ("ordem", "questao", "anulada")
    ordering = ("ordem",)
    autocomplete_fields = ("questao",)


@admin.register(Caderno)
class CadernoAdmin(admin.ModelAdmin):
    inlines = [ItemInline]

    list_display = ("id", "nome", "excluido", "created_by", "created_at")
    list_filter = ("excluido", "created_by", ("created_at", admin.DateFieldListFilter))
    search_fields = ("nome", "created_by__username", "created_by__email")
    ordering = ("-created_at",)
    readonly_fields = ("created_by", "created_at")

    def save_model(self, request, obj, form, change):
        if not obj.pk:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)
