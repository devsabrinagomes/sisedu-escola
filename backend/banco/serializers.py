import json
from rest_framework import serializers

from .models import (
    Subject,
    Descriptor,
    Topic,
    Skill,
    Question,
    QuestionVersion,
    QuestionOption,
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

    # nested
    versions = QuestionVersionSerializer(many=True, read_only=True)

    # payloads do form (write-only)
    options_payload = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Question
        fields = [
            "id",
            "private",
            "deleted",
            "created_by",
            "created_at",
            "versions",
            "subject_name",
            "options_payload",
        ]
        read_only_fields = ["deleted", "created_at", "versions", "subject_name"]

    def get_subject_name(self, obj):
        v = obj.versions.order_by("-version_number", "-created_at").first()
        return v.subject.name if v and v.subject_id else None

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

        if not (2 <= len(data) <= 5):
            raise serializers.ValidationError("Envie 2 a 5 alternativas.")

        # valida 1 correta
        correct_count = sum(1 for o in data if bool(o.get("correct")))
        if correct_count != 1:
            raise serializers.ValidationError("Marque exatamente 1 alternativa correta.")

        # valida letters únicas
        letters = [str(o.get("letter", "")).upper() for o in data]
        if any(l not in ["A", "B", "C", "D", "E"] for l in letters):
            raise serializers.ValidationError("Cada alternativa deve ter letter A-E.")
        if len(set(letters)) != len(letters):
            raise serializers.ValidationError("Não repita a mesma letter nas alternativas.")

        return data

    def _create_version_and_options(self, question: Question, req):
        # campos da versão vêm do FormData
        subject_id = req.data.get("subject")
        if not subject_id:
            raise serializers.ValidationError({"subject": "Obrigatório."})

        descriptor_id = req.data.get("descriptor") or None
        skill_id = req.data.get("skill") or None

        # versão: pega maior e soma 1
        last = question.versions.order_by("-version_number", "-created_at").first()
        next_version = (last.version_number + 1) if last else 1

        version = QuestionVersion.objects.create(
            question=question,
            version_number=next_version,
            title=req.data.get("title", "") or "",
            command=req.data.get("command", "") or "",
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

        raw = req.data.get("options_payload")
        options = self._parse_options_payload(raw)

        for opt in options:
            letter = str(opt.get("letter")).upper()
            option = QuestionOption.objects.create(
                question_version=version,
                letter=letter,
                option_text=opt.get("option_text", "") or "",
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
