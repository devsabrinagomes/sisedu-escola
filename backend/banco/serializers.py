import json
from django.db import transaction
from django.db.models import Max
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import (
    Subject,
    Descriptor,
    Topic,
    Skill,
    Question,
    QuestionVersion,
    QuestionOption,
    BookletItem,
    Booklet,
    Offer,
    Application,
    StudentAnswer,
)


# =====================
# READ-ONLY CURRICULUM
# =====================

class SubjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subject
        fields = ["id", "name"]


class DescriptorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Descriptor
        fields = ["id", "topic", "code", "name"]

class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ["id", "subject", "description"]

class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ["id", "descriptor", "code", "name"]


# =====================
# OPTIONS
# =====================

class QuestionOptionSerializer(serializers.ModelSerializer):
    def validate(self, attrs):
        option_text = attrs.get("option_text")
        option_image = attrs.get("option_image")

        has_text = bool(str(option_text or "").strip())
        has_image = bool(option_image)

        if has_text and has_image:
            raise serializers.ValidationError(
                {"option": "Cada alternativa deve ter somente texto ou imagem, nunca ambos."}
            )
        if not has_text and not has_image:
            raise serializers.ValidationError(
                {"option": "Cada alternativa deve ter conteúdo: texto ou imagem."}
            )

        if has_text:
            attrs["option_text"] = str(option_text).strip()
            attrs["option_image"] = None
        else:
            attrs["option_text"] = None

        return attrs

    class Meta:
        model = QuestionOption
        fields = ["id", "letter", "option_text", "option_image", "correct"]


# =====================
# VERSION
# =====================

class QuestionVersionSerializer(serializers.ModelSerializer):
    options = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = QuestionVersion
        fields = [
            "id",
            "question",
            "version_number",
            "title",
            "command",
            "support_text",
            "support_image",
            "image_reference",
            "subject",
            "descriptor",
            "skill",
            "annulled",
            "created_at",
            "options",
        ]
        read_only_fields = ["created_at", "version_number", "options"]

    def get_options(self, obj):
        qs = obj.options.all().order_by("letter")
        return QuestionOptionSerializer(qs, many=True, context=self.context).data


# =====================
# QUESTION
# =====================

class QuestionSerializer(serializers.ModelSerializer):
    # helpers pra UI
    subject_name = serializers.SerializerMethodField(read_only=True)
    created_by = serializers.IntegerField(read_only=True)
    created_by_name = serializers.SerializerMethodField(read_only=True)

    # nested
    versions = QuestionVersionSerializer(many=True, read_only=True)

    # payloads do form (write-only)
    options_payload = serializers.CharField(write_only=True, required=False)
    annulled = serializers.BooleanField(write_only=True, required=False)

    class Meta:
        model = Question
        fields = [
            "id",
            "private",
            "deleted",
            "created_by",
            "created_by_name",
            "created_at",
            "versions",
            "subject_name",
            "options_payload",
            "annulled",
        ]
        read_only_fields = [
            "created_by",
            "created_by_name",
            "deleted",
            "created_at",
            "versions",
            "subject_name",
        ]

    def get_subject_name(self, obj):
        v = obj.versions.order_by("-version_number", "-created_at").first()
        return v.subject.name if v and v.subject_id else None

    def get_created_by_name(self, obj):
        created_by_id = getattr(obj, "created_by", None)
        if not created_by_id:
            return ""

        if not hasattr(self, "_users_by_id"):
            self._users_by_id = {}

        if created_by_id not in self._users_by_id:
            user_model = get_user_model()
            self._users_by_id[created_by_id] = user_model.objects.filter(id=created_by_id).first()

        user = self._users_by_id.get(created_by_id)
        if not user:
            return str(created_by_id)

        return str(user.username or "")

    # ---------------------
    # helpers internos
    # ---------------------

    def _get_request(self):
        req = self.context.get("request")
        if not req:
            raise serializers.ValidationError("Request não encontrado no serializer context.")
        return req

    def _parse_options_payload(self, raw):
        if not raw:
            return []
        try:
            data = json.loads(raw)
        except Exception:
            raise serializers.ValidationError("options_payload inválido (JSON).")

        if not isinstance(data, list):
            raise serializers.ValidationError("options_payload deve ser uma lista.")

        if not (4 <= len(data) <= 5):
            raise serializers.ValidationError("A questão deve ter de 4 a 5 alternativas.")

        # valida 1 correta
        correct_count = sum(1 for o in data if bool(o.get("correct")))
        if correct_count != 1:
            raise serializers.ValidationError("Marque exatamente 1 alternativa correta.")

        expected_letters = ["A", "B", "C", "D"] if len(data) == 4 else ["A", "B", "C", "D", "E"]
        normalized_data = []
        informed_letters = []

        for index, opt in enumerate(data):
            if not isinstance(opt, dict):
                raise serializers.ValidationError("Cada alternativa deve ser um objeto.")

            informed_letter = str(opt.get("letter", "") or "").strip().upper()
            if informed_letter:
                informed_letters.append(informed_letter)

            normalized = dict(opt)
            normalized["letter"] = informed_letter or expected_letters[index]
            normalized_data.append(normalized)

        if informed_letters and len(set(informed_letters)) != len(informed_letters):
            raise serializers.ValidationError("Não repita a mesma letter nas alternativas.")

        normalized_letters = [opt["letter"] for opt in normalized_data]
        if normalized_letters != expected_letters:
            letters_text = ", ".join(expected_letters)
            raise serializers.ValidationError(
                f"As alternativas devem seguir a ordem {letters_text}."
            )

        return normalized_data

    def _create_version_and_options(self, question: Question, req):
        # campos da versão vêm do FormData
        subject_id = req.data.get("subject")
        if not subject_id:
            raise serializers.ValidationError({"subject": "Obrigatório."})
        title = req.data.get("title")
        if title is None or str(title).strip() == "":
            raise serializers.ValidationError({"title": "Obrigatório."})
        command = req.data.get("command")
        if command is None or str(command).strip() == "":
            raise serializers.ValidationError({"command": "Obrigatório."})

        descriptor_id = req.data.get("descriptor") or None
        skill_id = req.data.get("skill") or None
        raw = req.data.get("options_payload")
        options = self._parse_options_payload(raw)

        for opt in options:
            letter = str(opt.get("letter")).upper()
            text_value = str(opt.get("option_text", "") or "").strip()
            file_key = f"option_image_{letter}"
            has_text = bool(text_value)
            has_image = file_key in req.FILES

            if has_text and has_image:
                raise serializers.ValidationError(
                    {"options_payload": f"Alternativa {letter}: envie texto ou imagem, não os dois."}
                )
            if not has_text and not has_image:
                raise serializers.ValidationError(
                    {"options_payload": f"Alternativa {letter}: informe texto ou imagem."}
                )

        # versão: pega maior e soma 1
        last = question.versions.order_by("-version_number", "-created_at").first()
        next_version = (last.version_number + 1) if last else 1

        version = QuestionVersion.objects.create(
            question=question,
            version_number=next_version,
            title=title,
            command=command,
            support_text=req.data.get("support_text", "") or "",
            image_reference=req.data.get("image_reference", "") or "",
            subject_id=int(subject_id),
            descriptor_id=int(descriptor_id) if descriptor_id else None,
            skill_id=int(skill_id) if skill_id else None,
            annulled=False,
        )

        # suporte imagem
        if "support_image" in req.FILES:
            version.support_image = req.FILES["support_image"]
            version.save(update_fields=["support_image"])

        for opt in options:
            letter = str(opt.get("letter")).upper()
            text_value = str(opt.get("option_text", "") or "").strip()
            option = QuestionOption.objects.create(
                question_version=version,
                letter=letter,
                option_text=text_value or None,
                correct=bool(opt.get("correct")),
            )

            # imagem por letra: option_image_A etc
            file_key = f"option_image_{letter}"
            if file_key in req.FILES:
                option.option_image = req.FILES[file_key]
                option.save(update_fields=["option_image"])

        return version

    # ---------------------
    # CREATE
    # ---------------------

    def create(self, validated_data):
        req = self._get_request()

        # created_by no teu model é BigInteger; ideal: usar request.user.id
        # se tu não tem auth de user, deixa cair no validated_data se vier.
        if "created_by" not in validated_data:
            if getattr(req, "user", None) and req.user.is_authenticated:
                validated_data["created_by"] = req.user.id

        with transaction.atomic():
            question = Question.objects.create(
                private=bool(req.data.get("private", False) in ["true", "True", "1", True]),
                deleted=False,
                created_by=validated_data.get("created_by", 1),
            )

            # primeira versão + opções
            self._create_version_and_options(question, req)
            return question

    # ---------------------
    # UPDATE (cria NOVA versão)
    # ---------------------

    def update(self, instance: Question, validated_data):
        req = self._get_request()

        # PATCH parcial: atualiza campos simples sem exigir payload de criação de versão.
        if req.method == "PATCH":
            update_question_fields = []

            if "private" in validated_data:
                instance.private = bool(validated_data["private"])
                update_question_fields.append("private")

            if "annulled" in validated_data:
                latest_version = instance.versions.order_by("-version_number", "-created_at").first()
                if not latest_version:
                    raise serializers.ValidationError({"annulled": "A questão não possui versão para atualizar."})
                latest_version.annulled = bool(validated_data["annulled"])
                latest_version.save(update_fields=["annulled"])

            if update_question_fields:
                instance.save(update_fields=update_question_fields)

            if "private" in validated_data or "annulled" in validated_data:
                return instance

        with transaction.atomic():
            # permite mudar private
            if "private" in req.data:
                instance.private = bool(req.data.get("private") in ["true", "True", "1", True])
                instance.save(update_fields=["private"])

            # sempre cria uma nova versão (modelo versionado)
            new_version = self._create_version_and_options(instance, req)

            # remoção de suporte (só afeta a nova versão, normalmente é isso que vc quer)
            if req.data.get("remove_support_image") in ["1", 1, True, "true", "True"]:
                if new_version.support_image:
                    new_version.support_image.delete(save=False)
                new_version.support_image = None
                new_version.save(update_fields=["support_image"])

            # remoção de imagem de alternativa por letra (na nova versão)
            for letter in ["A", "B", "C", "D", "E"]:
                if req.data.get(f"remove_option_image_{letter}") in ["1", 1, True, "true", "True"]:
                    opt = new_version.options.filter(letter=letter).first()
                    if opt and opt.option_image:
                        opt.option_image.delete(save=False)
                        opt.option_image = None
                        opt.save(update_fields=["option_image"])

            return instance


class AddQuestionToBookletSerializer(serializers.Serializer):
    question_id = serializers.IntegerField(min_value=1)

    def validate(self, attrs):
        question_id = attrs["question_id"]
        booklet = self.context["booklet"]

        question = Question.objects.filter(id=question_id, deleted=False).first()
        if not question:
            raise serializers.ValidationError({"question_id": "Questão não encontrada."})

        already_exists = BookletItem.objects.filter(
            booklet=booklet,
            question_version__question_id=question.id,
        ).exists()
        if already_exists:
            raise serializers.ValidationError({"question_id": "Esta questão já foi adicionada neste caderno."})

        latest_version = question.versions.order_by("-version_number", "-created_at").first()
        if not latest_version:
            raise serializers.ValidationError({"question_id": "A questão não possui versão disponível."})

        attrs["question_version"] = latest_version
        return attrs

    def create(self, validated_data):
        booklet: Booklet = self.context["booklet"]
        question_version = validated_data["question_version"]
        max_order = booklet.items.aggregate(max_order=Max("order")).get("max_order") or 0

        return BookletItem.objects.create(
            booklet=booklet,
            question_version=question_version,
            order=max_order + 1,
        )


class BookletItemSerializer(serializers.ModelSerializer):
    question_id = serializers.IntegerField(source="question_version.question_id", read_only=True)
    question_version_data = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = BookletItem
        fields = [
            "id",
            "booklet",
            "order",
            "question_id",
            "question_version",
            "question_version_data",
        ]

    def get_question_version_data(self, obj):
        version = getattr(obj, "question_version", None)
        if not version:
            return None
        subject = getattr(version, "subject", None)
        return {
            "id": version.id,
            "question": version.question_id,
            "version_number": version.version_number,
            "title": version.title,
            "subject": version.subject_id,
            "subject_name": getattr(subject, "name", None),
            "descriptor": version.descriptor_id,
            "skill": version.skill_id,
            "annulled": version.annulled,
            "created_at": version.created_at,
        }


class BookletSerializer(serializers.ModelSerializer):
    items = BookletItemSerializer(many=True, read_only=True)
    items_count = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = Booklet
        fields = [
            "id",
            "name",
            "deleted",
            "created_at",
            "created_by",
            "items_count",
            "items",
        ]
        read_only_fields = ["id", "deleted", "created_at", "created_by", "items_count", "items"]

    def get_items_count(self, obj):
        return obj.items.count()


class OfferSerializer(serializers.ModelSerializer):
    booklet_name = serializers.CharField(source="booklet.name", read_only=True)

    class Meta:
        model = Offer
        fields = [
            "id",
            "booklet",
            "booklet_name",
            "start_date",
            "end_date",
            "description",
            "deleted",
            "created_at",
            "created_by",
        ]
        read_only_fields = ["id", "deleted", "created_at", "created_by", "booklet_name"]

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        description = attrs.get("description", getattr(self.instance, "description", None))

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError(
                {"end_date": "A data de fim deve ser maior ou igual à data de início."}
            )

        if description is None or not str(description).strip():
            raise serializers.ValidationError(
                {"description": "Descrição é obrigatória."}
            )
        return attrs


class ApplicationSyncStudentSerializer(serializers.Serializer):
    student_ref = serializers.IntegerField(min_value=1)
    name = serializers.CharField(max_length=255, allow_blank=True, required=False)


class ApplicationSyncSerializer(serializers.Serializer):
    class_ref = serializers.IntegerField(min_value=1)
    students = ApplicationSyncStudentSerializer(many=True)


class StudentAnswerUpsertSerializer(serializers.Serializer):
    booklet_item = serializers.IntegerField(min_value=1)
    selected_option = serializers.CharField(max_length=1, allow_null=True, allow_blank=True, required=False)

    def validate_selected_option(self, value):
        if value in [None, ""]:
            return None
        letter = str(value).strip().upper()
        if letter not in ["A", "B", "C", "D", "E"]:
            raise serializers.ValidationError("selected_option deve ser A, B, C, D, E ou null.")
        return letter


class StudentAnswersBulkUpsertSerializer(serializers.Serializer):
    answers = StudentAnswerUpsertSerializer(many=True)


class StudentAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentAnswer
        fields = ["id", "application", "booklet_item", "selected_option", "is_correct", "created_at"]
        read_only_fields = ["id", "application", "is_correct", "created_at"]
