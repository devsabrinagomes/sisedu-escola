import random

from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction

from banco.models import Disciplina, Saber, Habilidade, Questao, Resposta


class Command(BaseCommand):
    help = "Cria dados fictícios (disciplinas, saberes, habilidades, questões e alternativas)"

    @transaction.atomic
    def handle(self, *args, **kwargs):
        random.seed(42)

        # 1) DISCIPLINAS (idempotente por sigla)
        disciplinas = [
            ("MAT", "Matemática"),
            ("LP", "Português"),
            ("HIS", "História"),
            ("GEO", "Geografia"),
            ("BIO", "Biologia"),
            ("FIS", "Física"),
            ("QUI", "Química")
        ]
        disc_map = {}

        for sigla, nome in disciplinas:
            d = Disciplina.objects.filter(sigla=sigla).first()
            if not d:
                d = Disciplina.objects.filter(nome=nome).first()

            if d:
                changed = False
                if d.sigla != sigla:
                    d.sigla = sigla
                    changed = True
                if d.nome != nome:
                    d.nome = nome
                    changed = True
                if changed:
                    d.save()
            else:
                d = Disciplina.objects.create(sigla=sigla, nome=nome)

            disc_map[sigla] = d  # 🔥 garante que nunca vai ser None


        # 2) USERS (idempotente)
        User = get_user_model()
        profs = []
        for i in range(1, 4):
            u, created = User.objects.update_or_create(
                username=f"prof{i}",
                defaults={"email": f"prof{i}@escola.com"},
            )
            if created:
                u.set_password("123456")
                u.save()
            profs.append(u)

        # helper pra pegar um prof
        def pick_prof():
            return random.choice(profs)
        
        for sigla, _ in disciplinas:
            disc = disc_map.get(sigla)
            if not disc:
                raise Exception(f"Disciplina {sigla} não foi criada/encontrada.")


        # 3) SABERES + HABILIDADES
        # cria 2 saberes por disciplina e 3 habilidades por saber
        saber_map = {}       # (sigla, "S01") -> Saber
        habilidade_map = {}  # (sigla, "S01", "H01") -> Habilidade

        for sigla, _ in disciplinas:
            disc = disc_map[sigla]
            for s_idx in range(1, 3):  # S01..S02
                cod_s = f"S{s_idx:02d}"
                saber, _ = Saber.objects.update_or_create(
                    disciplina=disc,
                    codigo=cod_s,
                    defaults={"titulo": f"Saber {cod_s} - {disc.nome}"},
                )
                saber_map[(sigla, cod_s)] = saber

                for h_idx in range(1, 4):  # H01..H03
                    cod_h = f"{cod_s}.H{h_idx:02d}"
                    hab, _ = Habilidade.objects.update_or_create(
                        saber=saber,
                        codigo=cod_h,
                        defaults={"titulo": f"Habilidade {cod_h} - {disc.nome}"},
                    )
                    habilidade_map[(sigla, cod_s, f"H{h_idx:02d}")] = hab

        # 4) QUESTÕES + RESPOSTAS
        # cria 3 questões por disciplina
        # - algumas com saber/habilidade, outras sem (pra testar opcional)
        for sigla, _ in disciplinas:
            disc = disc_map[sigla]

            for q_idx in range(1, 4):
                # escolhe saber/habilidade às vezes
                usar_saber = (q_idx % 2 == 1)   # alterna
                usar_hab = (q_idx % 3 == 0)     # de vez em quando

                saber = None
                habilidade = None
                if usar_saber:
                    saber = saber_map[(sigla, "S01")]
                if usar_hab and saber:
                    habilidade = habilidade_map[(sigla, "S01", "H01")]

                enunciado = f"<p>({sigla}) Questão {q_idx}: marque a alternativa correta.</p>"
                suporte = f"<p>Texto de apoio opcional para ({sigla}) questão {q_idx}.</p>"

                # chave idempotente: disciplina + enunciado_html (simples pro seed)
                questao, _ = Questao.objects.update_or_create(
                    disciplina=disc,
                    enunciado_html=enunciado,
                    defaults={
                        "saber": saber,
                        "habilidade": habilidade,
                        "texto_suporte_html": suporte,
                        "ref_imagem": "",
                        "excluida": False,
                        "is_private": False,
                        "created_by": pick_prof(),
                    },
                )

                # limpa alternativas anteriores (pra seed ser repetível)
                Resposta.objects.filter(questao=questao).delete()

                # cria 4 alternativas (A-D), 1 correta random
                n_alt = random.choice([2, 3, 4, 5])
                correta_ordem = random.randint(1, n_alt)

                for ordem in range(1, n_alt + 1):
                    Resposta.objects.create(
                        questao=questao,
                        ordem=ordem,
                        texto_html=f"<p>Alternativa {ordem} da questão {q_idx} ({sigla}).</p>",
                        correta=(ordem == correta_ordem),
                    )

        self.stdout.write(self.style.SUCCESS("Seed ok (disciplinas, saberes, habilidades, questões e alternativas)"))
