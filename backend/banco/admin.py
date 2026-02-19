from django.contrib import admin
from django.core.exceptions import ValidationError
from django.forms.models import BaseInlineFormSet
from django.utils.html import strip_tags

from .models import (
    Subject,
    Topic,
    Descriptor,
    Skill,
    LegacyMap,
    Question,
    QuestionVersion,
    QuestionOption,
    Booklet,
    BookletItem,
    Offer,
    Application,
    StudentAnswer,
)


# =========================
# CURRÍCULO
# =========================

@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ("id", "name")
    search_fields = ("name",)


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ("id", "subject", "description_short")
    list_filter = ("subject",)
    search_fields = ("description", "subject__name")

    @admin.display(description="Description")
    def description_short(self, obj):
        txt = (obj.description or "").strip()
        return (txt[:90] + "…") if len(txt) > 90 else txt


@admin.register(Descriptor)
class DescriptorAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name_short", "topic", "subject")
    list_filter = ("topic__subject", "topic")
    search_fields = ("code", "name", "topic__description", "topic__subject__name")
    ordering = ("topic__subject__name", "topic__id", "code")

    @admin.display(description="Subject")
    def subject(self, obj):
        return obj.topic.subject if obj.topic_id else None

    @admin.display(description="Name")
    def name_short(self, obj):
        txt = (obj.name or "").strip()
        return (txt[:80] + "…") if len(txt) > 80 else txt


@admin.register(Skill)
class SkillAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name_short", "descriptor", "subject")
    list_filter = ("descriptor__topic__subject", "descriptor")
    search_fields = ("code", "name", "descriptor__code", "descriptor__name")
    ordering = ("descriptor__topic__subject__name", "descriptor__code", "code")

    @admin.display(description="Subject")
    def subject(self, obj):
        return obj.descriptor.topic.subject if obj.descriptor_id and obj.descriptor.topic_id else None

    @admin.display(description="Name")
    def name_short(self, obj):
        txt = (obj.name or "").strip()
        return (txt[:80] + "…") if len(txt) > 80 else txt


@admin.register(LegacyMap)
class LegacyMapAdmin(admin.ModelAdmin):
    list_display = ("id", "type", "legacy_id", "legacy_code", "legacy_name", "status", "created_at")
    list_filter = ("type", "status", ("created_at", admin.DateFieldListFilter))
    search_fields = ("legacy_raw", "legacy_code", "legacy_name")
    ordering = ("-created_at",)


# =========================
# OPTIONS INLINE (QuestionOption)
# =========================

class QuestionOptionInlineFormSet(BaseInlineFormSet):
    def clean(self):
        super().clean()

        filled = 0
        correct = 0

        for form in self.forms:
            if not getattr(form, "cleaned_data", None):
                continue
            if form.cleaned_data.get("DELETE"):
                continue

            text = (form.cleaned_data.get("option_text") or "").strip()
            img = form.cleaned_data.get("option_image")
            is_correct = bool(form.cleaned_data.get("correct"))

            has_content = bool(text) or bool(img)
            if has_content:
                filled += 1
                if is_correct:
                    correct += 1
            else:
                if is_correct:
                    raise ValidationError("Não dá pra marcar como correta uma alternativa vazia.")

        if filled < 2:
            raise ValidationError("A questão precisa ter no mínimo 2 alternativas preenchidas.")
        if filled > 5:
            raise ValidationError("A questão pode ter no máximo 5 alternativas preenchidas.")
        if correct != 1:
            raise ValidationError("Marque exatamente 1 alternativa correta (entre as preenchidas).")


class QuestionOptionInline(admin.TabularInline):
    model = QuestionOption
    formset = QuestionOptionInlineFormSet
    extra = 5
    min_num = 2
    max_num = 5
    validate_min = True
    validate_max = True

    fields = ("letter", "option_text", "option_image", "correct")
    ordering = ("letter",)


# =========================
# QUESTION VERSION ADMIN
# =========================

@admin.register(QuestionVersion)
class QuestionVersionAdmin(admin.ModelAdmin):
    inlines = [QuestionOptionInline]

    list_display = (
        "id",
        "question",
        "version_number",
        "title_short",
        "subject",
        "descriptor",
        "skill",
        "annulled",
        "created_at",
    )
    list_filter = (
        "subject",
        "descriptor",
        "skill",
        "annulled",
        ("created_at", admin.DateFieldListFilter),
    )
    search_fields = (
        "title",
        "command",
        "support_text",
        "question__id",
        "subject__name",
        "descriptor__code",
        "skill__code",
    )
    ordering = ("-created_at",)

    autocomplete_fields = ("question", "subject", "descriptor", "skill")

    @admin.display(description="Title")
    def title_short(self, obj):
        txt = strip_tags(obj.title or "").replace("\n", " ").strip()
        return (txt[:90] + "…") if len(txt) > 90 else txt


# =========================
# QUESTION ADMIN
# =========================

class QuestionVersionInline(admin.TabularInline):
    model = QuestionVersion
    extra = 0
    fields = ("version_number", "subject", "descriptor", "skill", "annulled", "created_at")
    readonly_fields = ("created_at",)
    ordering = ("-version_number",)
    show_change_link = True
    autocomplete_fields = ("subject", "descriptor", "skill")


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    inlines = [QuestionVersionInline]

    list_display = (
        "id",
        "private",
        "deleted",
        "created_by",
        "created_at",
        "latest_subject",
        "latest_skill",
    )

    list_filter = (
        "private",
        "deleted",
        ("created_at", admin.DateFieldListFilter),
    )

    search_fields = ("id", "created_by")
    ordering = ("-created_at",)

    @admin.display(description="Latest subject")
    def latest_subject(self, obj):
        v = obj.versions.order_by("-version_number", "-created_at").first()
        return v.subject if v else None

    @admin.display(description="Latest skill")
    def latest_skill(self, obj):
        v = obj.versions.order_by("-version_number", "-created_at").first()
        return v.skill if v else None


# =========================
# BOOKLET
# =========================

class BookletItemInline(admin.TabularInline):
    model = BookletItem
    extra = 0
    fields = ("order", "question_version")
    ordering = ("order",)
    autocomplete_fields = ("question_version",)


@admin.register(Booklet)
class BookletAdmin(admin.ModelAdmin):
    inlines = [BookletItemInline]
    list_display = ("id", "name", "deleted", "created_by", "created_at")
    list_filter = ("deleted", ("created_at", admin.DateFieldListFilter))
    search_fields = ("name", "created_by")
    ordering = ("-created_at",)


@admin.register(BookletItem)
class BookletItemAdmin(admin.ModelAdmin):
    list_display = ("id", "booklet", "order", "question_version")
    list_filter = ("booklet",)
    search_fields = ("booklet__name", "question_version__id")
    ordering = ("booklet_id", "order")
    autocomplete_fields = ("booklet", "question_version")



# =========================
# OFFER / APPLICATION / ANSWERS (opcional)
# =========================

@admin.register(Offer)
class OfferAdmin(admin.ModelAdmin):
    list_display = ("id", "booklet", "start_date", "end_date", "deleted", "created_by", "created_at")
    list_filter = ("deleted", ("start_date", admin.DateFieldListFilter), ("end_date", admin.DateFieldListFilter))
    search_fields = ("id", "description", "created_by")
    ordering = ("-created_at",)
    autocomplete_fields = ("booklet",)


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ("id", "offer", "class_ref", "student_ref", "student_absent", "finalized_at")
    list_filter = ("student_absent",)
    search_fields = ("class_ref", "student_ref")
    autocomplete_fields = ("offer",)


@admin.register(StudentAnswer)
class StudentAnswerAdmin(admin.ModelAdmin):
    list_display = ("id", "application", "booklet_item", "selected_option", "is_correct", "created_at")
    list_filter = ("is_correct", ("created_at", admin.DateFieldListFilter))
    autocomplete_fields = ("application", "booklet_item")
