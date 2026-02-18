import json
from rest_framework import serializers
from .models import Disciplina, Questao, Resposta, Saber, Habilidade


class DisciplinaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Disciplina
        fields = ["id", "nome"]


class SaberSerializer(serializers.ModelSerializer):
    disciplina_nome = serializers.CharField(source="disciplina.nome", read_only=True)

    class Meta:
        model = Saber
        fields = ["id", "disciplina", "disciplina_nome", "codigo", "titulo"]


class HabilidadeSerializer(serializers.ModelSerializer):
    saber_titulo = serializers.CharField(source="saber.titulo", read_only=True)
    disciplina_id = serializers.IntegerField(source="saber.disciplina_id", read_only=True)

    class Meta:
        model = Habilidade
        fields = ["id", "saber", "saber_titulo", "disciplina_id", "codigo", "titulo"]


class RespostaSerializer(serializers.ModelSerializer):
    opcao = serializers.CharField(read_only=True)

    class Meta:
        model = Resposta
        fields = ["id", "ordem", "opcao", "texto_html", "imagem", "correta"]


class QuestaoSerializer(serializers.ModelSerializer):
    disciplina_nome = serializers.CharField(source="disciplina.nome", read_only=True)
    criado_por = serializers.CharField(source="created_by.username", read_only=True)

    # retorna respostas
    respostas = RespostaSerializer(many=True, read_only=True)

    # recebe respostas no multipart como JSON string
    respostas_payload = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = Questao
        fields = [
            "id",
            "disciplina",
            "disciplina_nome",
            "saber",
            "habilidade",
            "enunciado_html",
            "comando_html",
            "texto_suporte_html",
            "imagem_suporte",
            "ref_imagem",
            "excluida",
            "is_private",
            "criado_por",
            "created_at",
            "respostas",
            "respostas_payload",
        ]
        read_only_fields = ["criado_por", "created_at", "respostas"]

    # ---------- helpers ----------
    def _req_files_data(self):
        req = self.context.get("request")
        files = getattr(req, "FILES", {}) if req else {}
        data = getattr(req, "data", {}) if req else {}
        return files, data

    def _parse_respostas(self, raw):
        if raw is None or raw == "":
            return None
        try:
            data = json.loads(raw)
        except Exception:
            raise serializers.ValidationError({"respostas_payload": "Envie um JSON válido."})

        if not isinstance(data, list):
            raise serializers.ValidationError({"respostas_payload": "Envie uma lista de respostas."})

        return data

    def _validate_respostas_create(self, respostas, files):
        n = len(respostas)
        if not (2 <= n <= 5):
            raise serializers.ValidationError({"respostas_payload": "Envie de 2 a 5 alternativas."})

        ordens = [int(r.get("ordem")) for r in respostas]
        if sorted(ordens) != list(range(1, n + 1)):
            raise serializers.ValidationError({"respostas_payload": "As ordens precisam ser 1..N (sem buracos)."})

        corretas = [r for r in respostas if r.get("correta") is True]
        if len(corretas) != 1:
            raise serializers.ValidationError({"respostas_payload": "Marque exatamente 1 alternativa como correta."})

        # texto OU imagem nova
        for r in respostas:
            ordem = int(r.get("ordem"))
            texto = (r.get("texto_html") or "").strip()
            tem_img = f"resposta_imagem_{ordem}" in files
            if not texto and not tem_img:
                raise serializers.ValidationError(
                    {"respostas_payload": f"A alternativa {ordem} precisa ter texto ou imagem."}
                )

    # ---------- DRF validate ----------
    def validate(self, attrs):
        # remove campo que não existe no model
        attrs_model = dict(attrs)
        attrs_model.pop("respostas_payload", None)

        instance = self.instance
        if instance:
            # aplica no instance pra rodar clean()
            for k, v in attrs_model.items():
                setattr(instance, k, v)
            instance.clean()
        else:
            tmp = Questao(**attrs_model)
            tmp.clean()

        return attrs

    # ---------- create ----------
    def create(self, validated_data):
        files, _data = self._req_files_data()
        raw = validated_data.pop("respostas_payload", None)
        respostas = self._parse_respostas(raw)

        questao = Questao.objects.create(**validated_data)

        if respostas is not None:
            self._validate_respostas_create(respostas, files)

            objs = []
            for r in respostas:
                ordem = int(r["ordem"])
                img = files.get(f"resposta_imagem_{ordem}")
                objs.append(
                    Resposta(
                        questao=questao,
                        ordem=ordem,
                        texto_html=r.get("texto_html", "") or "",
                        imagem=img,
                        correta=bool(r.get("correta")),
                    )
                )
            Resposta.objects.bulk_create(objs)

        return questao

    # ---------- update ----------
    def update(self, instance, validated_data):
        files, data = self._req_files_data()
        raw = validated_data.pop("respostas_payload", None)
        respostas = self._parse_respostas(raw)

        # campos da questão
        for k, v in validated_data.items():
            setattr(instance, k, v)

        # imagem suporte remove/substitui
        if str(data.get("remove_imagem_suporte", "")).lower() in ("1", "true", "yes"):
            instance.imagem_suporte = None
        elif files.get("imagem_suporte"):
            instance.imagem_suporte = files.get("imagem_suporte")

        instance.save()

        if respostas is not None:
            n = len(respostas)
            if not (2 <= n <= 5):
                raise serializers.ValidationError({"respostas_payload": "Envie de 2 a 5 alternativas."})

            ordens = sorted(int(r.get("ordem")) for r in respostas)
            if ordens != list(range(1, n + 1)):
                raise serializers.ValidationError({"respostas_payload": "As ordens precisam ser 1..N (sem buracos)."})

            if sum(1 for r in respostas if r.get("correta") is True) != 1:
                raise serializers.ValidationError({"respostas_payload": "Marque exatamente 1 alternativa como correta."})

            existing = {r.ordem: r for r in instance.respostas.all()}

            # valida texto OU imagem (nova ou existente, se não remover)
            for r in respostas:
                ordem = int(r.get("ordem"))
                texto = (r.get("texto_html") or "").strip()

                remove_flag = str(data.get(f"remove_resposta_imagem_{ordem}", "")).lower() in ("1", "true", "yes")
                has_new_img = bool(files.get(f"resposta_imagem_{ordem}"))
                has_old_img = bool(existing.get(ordem) and existing[ordem].imagem and not remove_flag)

                if not texto and not (has_new_img or has_old_img):
                    raise serializers.ValidationError(
                        {"respostas_payload": f"A alternativa {ordem} precisa ter texto ou imagem."}
                    )

            # IMPORTANTÍSSIMO: evitar violar uniq_uma_correta_por_questao durante save
            Resposta.objects.filter(questao=instance, correta=True).update(correta=False)

            # aplica updates/criações
            for r in respostas:
                ordem = int(r["ordem"])
                obj = existing.get(ordem) or Resposta(questao=instance, ordem=ordem)

                obj.texto_html = r.get("texto_html", "") or ""
                obj.correta = bool(r.get("correta"))

                # remover imagem alternativa
                if str(data.get(f"remove_resposta_imagem_{ordem}", "")).lower() in ("1", "true", "yes"):
                    obj.imagem = None

                # substituir imagem alternativa
                img = files.get(f"resposta_imagem_{ordem}")
                if img:
                    obj.imagem = img

                obj.save()

            # se encurtou (ex: antes tinha 5 e agora só 4), apaga as sobras
            instance.respostas.exclude(ordem__in=ordens).delete()

        return instance
