import re
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q


COD_SABER_RE = re.compile(r"^[A-Z]{2,5}\.S\d{2}$")          # MAT.S01
COD_HABIL_RE = re.compile(r"^[A-Z]{2,5}\.S\d{2}\.H\d{2}$")  # MAT.S01.H01



def next_code(model_cls, prefix: str, width: int = 4) -> str:
    last = (
        model_cls.objects
        .filter(codigo__startswith=f"{prefix}-")
        .order_by("-codigo")
        .values_list("codigo", flat=True)
        .first()
    )
    n = int(last.split("-")[1]) + 1 if last else 1
    return f"{prefix}-{n:0{width}d}"


class Disciplina(models.Model):
    sigla = models.CharField(max_length=5, unique=True)
    nome = models.CharField("Nome", max_length=120, unique=True)

    class Meta:
        verbose_name = "Disciplina"
        verbose_name_plural = "Disciplinas"
        ordering = ["nome"]

    def __str__(self):
        return self.nome


class Saber(models.Model):
    disciplina = models.ForeignKey(
        Disciplina,
        on_delete=models.PROTECT,
        related_name="saberes",
        verbose_name="Disciplina",
    )
    codigo = models.CharField("Código", max_length=20, blank=True, default="")
    titulo = models.CharField("Título", max_length=200)

    class Meta:
        verbose_name = "Saber"
        verbose_name_plural = "Saberes"
        ordering = ["disciplina__nome", "codigo", "titulo"]
        constraints = [
            models.UniqueConstraint(
                fields=["disciplina", "codigo"],
                name="uniq_saber_codigo_por_disciplina",
            )
        ]

    def clean(self):
        if self.codigo and not COD_SABER_RE.match(self.codigo):
            raise ValidationError({"codigo": "Use o padrão MAT.S01 (sigla + .S + 2 dígitos)."})
        super().clean()

    def save(self, *args, **kwargs):
        if not self.codigo:
            sigla = (self.disciplina.sigla or "").upper().strip()
            ultimo = (
                Saber.objects.filter(disciplina=self.disciplina, codigo__startswith=f"{sigla}.S")
                .order_by("-codigo")
                .values_list("codigo", flat=True)
                .first()
            )
            n = int(ultimo.split(".S")[1]) + 1 if ultimo else 1
            self.codigo = f"{sigla}.S{n:02d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.codigo} - {self.titulo}"


class Habilidade(models.Model):
    saber = models.ForeignKey(
        Saber,
        on_delete=models.PROTECT,
        related_name="habilidades",
        verbose_name="Saber",
    )
    codigo = models.CharField("Código", max_length=30, blank=True, default="")
    titulo = models.CharField("Título", max_length=200)

    class Meta:
        verbose_name = "Habilidade"
        verbose_name_plural = "Habilidades"
        ordering = ["saber__disciplina__nome", "saber__codigo", "codigo", "titulo"]
        constraints = [
            models.UniqueConstraint(
                fields=["saber", "codigo"],
                name="uniq_habilidade_codigo_por_saber",
            )
        ]

    def clean(self):
        if self.codigo and not COD_HABIL_RE.match(self.codigo):
            raise ValidationError({"codigo": "Use o padrão MAT.S01.H01 (sigla + .S + 2 dígitos + .H + 2 dígitos)."})
        # se digitarem manualmente, garante que começa com o saber certo
        if self.codigo and self.saber_id and not self.codigo.startswith(self.saber.codigo + ".H"):
            raise ValidationError({"codigo": "O código da habilidade precisa começar com o código do saber (ex: MAT.S01.H01)."})
        super().clean()

    def save(self, *args, **kwargs):
        if not self.codigo:
            prefix = f"{self.saber.codigo}.H"  # ex: MAT.S01.H
            ultimo = (
                Habilidade.objects.filter(saber=self.saber, codigo__startswith=prefix)
                .order_by("-codigo")
                .values_list("codigo", flat=True)
                .first()
            )
            n = int(ultimo.split(".H")[1]) + 1 if ultimo else 1
            self.codigo = f"{self.saber.codigo}.H{n:02d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.codigo} - {self.titulo}"


class Questao(models.Model):
    disciplina = models.ForeignKey(
        Disciplina,
        on_delete=models.PROTECT,
        related_name="questoes",
        verbose_name="Disciplina",
    )

    saber = models.ForeignKey(
        Saber,
        on_delete=models.PROTECT,
        related_name="questoes",
        verbose_name="Saber",
        blank=True,
        null=True,
    )

    habilidade = models.ForeignKey(
        Habilidade,
        on_delete=models.PROTECT,
        related_name="questoes",
        verbose_name="Habilidade",
        blank=True,
        null=True,
    )

    enunciado_html = models.TextField("Enunciado")
    texto_suporte_html = models.TextField("Texto de apoio", blank=True, default="")

    imagem_suporte = models.ImageField(
        "Imagem de apoio",
        upload_to="questoes/suporte/",
        blank=True,
        null=True,
    )
    ref_imagem = models.CharField(
        
        "Referência da imagem",
        max_length=500,
        blank=True,
        default="",
    )
    comando_html = models.TextField("Comando")
    excluida = models.BooleanField("Excluída", default=False)
    is_private = models.BooleanField("Privada", default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="questoes_criadas",
        verbose_name="Criado por",
    )
    created_at = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        verbose_name = "Questão"
        verbose_name_plural = "Questões"
        ordering = ["-created_at"]

    def __str__(self):
        texto = (self.enunciado_html or "").strip()
        return (texto[:60] + "…") if len(texto) > 60 else (texto or f"Questão {self.pk}")

    def clean(self):
        if self.saber and self.saber.disciplina_id != self.disciplina_id:
            raise ValidationError({"saber": "O saber precisa ser da mesma disciplina da questão."})

        if self.habilidade:
            if self.saber and self.habilidade.saber_id != self.saber_id:
                raise ValidationError({"habilidade": "A habilidade precisa pertencer ao saber selecionado."})
            if self.habilidade.saber.disciplina_id != self.disciplina_id:
                raise ValidationError({"habilidade": "A habilidade precisa ser da mesma disciplina da questão."})

        super().clean()

    @property
    def resposta_correta(self):
        return self.respostas.filter(correta=True).first()


class Resposta(models.Model):
    questao = models.ForeignKey(
        "Questao",
        on_delete=models.CASCADE,
        related_name="respostas",
        verbose_name="Questão",
    )

    ordem = models.PositiveSmallIntegerField("Ordem")  # 1..5
    texto_html = models.TextField("Texto da alternativa", blank=True, default="")
    imagem = models.ImageField(
        "Imagem da alternativa",
        upload_to="questoes/respostas/",
        blank=True,
        null=True,
    )
    correta = models.BooleanField("Correta?", default=False)

    class Meta:
        verbose_name = "Alternativa"
        verbose_name_plural = "Alternativas"
        ordering = ["questao_id", "ordem"]
        constraints = [
            models.UniqueConstraint(fields=["questao", "ordem"], name="uniq_ordem_por_questao"),
            models.UniqueConstraint(
                fields=["questao"],
                condition=Q(correta=True),
                name="uniq_uma_correta_por_questao",
            ),
        ]

    def clean(self):
        if not (self.texto_html or "").strip() and not self.imagem:
            raise ValidationError("A alternativa precisa ter texto ou imagem.")
        super().clean()

    @property
    def opcao(self):
        # 1->A, 2->B, 3->C...
        return chr(ord("A") + (self.ordem - 1))

    def __str__(self):
        return f"{self.questao_id} - {self.opcao}"


class Caderno(models.Model):
    nome = models.CharField("Nome", max_length=200)
    excluido = models.BooleanField("Excluído?", default=False)

    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="cadernos_criados",
        verbose_name="Criado por",
    )
    created_at = models.DateTimeField("Criado em", auto_now_add=True)

    class Meta:
        verbose_name = "Caderno"
        verbose_name_plural = "Cadernos"
        ordering = ["-created_at"]

    def __str__(self):
        return self.nome


class Item(models.Model):
    caderno = models.ForeignKey(
        Caderno,
        on_delete=models.CASCADE,
        related_name="itens",
        verbose_name="Caderno",
    )
    questao = models.ForeignKey(
        Questao,
        on_delete=models.PROTECT,
        related_name="itens",
        verbose_name="Questão",
    )
    ordem = models.PositiveIntegerField("Ordem")
    anulada = models.BooleanField("Anulada?", default=False)

    class Meta:
        verbose_name = "Item"
        verbose_name_plural = "Itens"
        ordering = ["ordem"]
        constraints = [
            models.UniqueConstraint(fields=["caderno", "ordem"], name="uniq_ordem_por_caderno"),
            models.UniqueConstraint(fields=["caderno", "questao"], name="uniq_questao_por_caderno"),
        ]

    def __str__(self):
        return f"{self.caderno} — #{self.ordem}"
