import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model
from django.utils import timezone

from banco.models import (
    Subject,
    Topic,
    Descriptor,
    Skill,
    Question,
    QuestionVersion,
    QuestionOption,
    Booklet,
    BookletItem,
    Offer,
    Application,
    StudentAnswer,
)


class Command(BaseCommand):
    help = "Cria dados fictícios para currículo, usuários e questões"

    @transaction.atomic
    def handle(self, *args, **kwargs):
        random.seed(42)

        # =====================================================
        # 1) USUÁRIOS
        # =====================================================
        User = get_user_model()

        seed_users = []
        for i in range(1, 4):
            user, _ = User.objects.update_or_create(
                username=f"prof{i}",
                defaults={
                    "email": f"prof{i}@escola.com",
                    "is_active": True,
                },
            )
            user.set_password("123456")
            user.save()
            seed_users.append(user)

        # =====================================================
        # 2) SUBJECTS
        # =====================================================
        subjects_data = [
            ("MAT", "Matemática"),
            ("LP", "Português"),
            ("HIS", "História"),
            ("GEO", "Geografia"),
            ("BIO", "Biologia"),
            ("FIS", "Física"),
            ("QUI", "Química"),
        ]

        subjects = {}
        for sigla, name in subjects_data:
            obj, _ = Subject.objects.get_or_create(name=name)
            subjects[sigla] = obj

        # =====================================================
        # 3) TOPICS + DESCRIPTORS + SKILLS
        # =====================================================
        all_skills = []

        for sigla, subject in subjects.items():
            for t_idx in range(1, 3):
                topic_desc = f"Tópico {t_idx} - {subject.name}"
                topic, _ = Topic.objects.get_or_create(
                    subject=subject,
                    description=topic_desc,
                )

                for d_idx in range(1, 3):
                    desc_code = f"{sigla}D{t_idx}{d_idx}"
                    desc_name = f"{desc_code} - Descritor {d_idx} ({topic_desc})"

                    descriptor, _ = Descriptor.objects.update_or_create(
                        code=desc_code,
                        defaults={
                            "topic": topic,
                            "name": desc_name,
                        }
                    )

                    for s_idx in range(1, 3):
                        skill_code = f"{desc_code}H{s_idx}"
                        skill_name = f"{skill_code} - Habilidade {s_idx}"

                        skill, _ = Skill.objects.update_or_create(
                            code=skill_code,
                            defaults={
                                "descriptor": descriptor,
                                "name": skill_name,
                            }
                        )

                        all_skills.append(skill)

        # =====================================================
        # 4) LIMPA DADOS ANTIGOS (SEED CONTROLADO)
        # =====================================================
        # Ambiente de desenvolvimento: limpeza total para manter
        # o seed determinístico entre execuções.
        # Ordem respeita FKs com on_delete=PROTECT.
        StudentAnswer.objects.all().delete()
        Application.objects.all().delete()
        Offer.objects.all().delete()
        BookletItem.objects.all().delete()
        Booklet.objects.all().delete()
        QuestionOption.objects.all().delete()
        QuestionVersion.objects.all().delete()
        Question.objects.all().delete()

        # =====================================================
        # 5) QUESTIONS + VERSION + OPTIONS
        # =====================================================
        for i in range(1, 11):
            seed_user = random.choice(seed_users)

            q = Question.objects.create(
                private=False,
                deleted=False,
                created_by=seed_user.id,
            )

            chosen_skill = random.choice(all_skills)
            chosen_descriptor = chosen_skill.descriptor
            chosen_subject = chosen_descriptor.topic.subject

            v = QuestionVersion.objects.create(
                question=q,
                version_number=1,
                title=f"({chosen_subject.name}) Questão {i}: marque a alternativa correta.",
                support_text="Texto de apoio opcional.",
                command="Marque a alternativa correta.",
                subject=chosen_subject,
                descriptor=chosen_descriptor,
                skill=chosen_skill,
                annulled=False,
            )

            letters = ["A", "B", "C", "D"]
            correct_letter = random.choice(letters)

            for letter in letters:
                QuestionOption.objects.create(
                    question_version=v,
                    letter=letter,
                    option_text=f"Alternativa {letter} da questão {i}.",
                    correct=(letter == correct_letter),
                )

        # =====================================================
        # 6) BOOKLETS + BOOKLET ITEMS
        # =====================================================
        question_versions = list(QuestionVersion.objects.all())
        if not question_versions:
            self.stdout.write(
                self.style.WARNING(
                    "Nenhuma QuestionVersion encontrada. Seed de cadernos não executado."
                )
            )
            self.stdout.write(
                self.style.SUCCESS("Seed ok (usuarios + curriculo + questoes)")
            )
            return

        booklet_names = [
            "Simulado ENEM – 1ª Série",
            "Avaliação Diagnóstica – Matemática",
            "Prova Bimestral – 2º Ano",
            "Revisão Final – Ciências da Natureza",
            "Caderno Interdisciplinar – Linguagens",
        ]

        total_versions = len(question_versions)
        min_items = min(5, total_versions)
        max_items = min(10, total_versions)

        self.stdout.write(
            f"Criando {len(booklet_names)} cadernos com {min_items} a {max_items} questões por caderno..."
        )

        for booklet_name in booklet_names:
            seed_user = random.choice(seed_users)
            booklet = Booklet.objects.create(
                name=booklet_name,
                deleted=False,
                created_by=seed_user.id,
            )

            items_count = random.randint(min_items, max_items)
            selected_versions = random.sample(question_versions, k=items_count)

            for order, question_version in enumerate(selected_versions, start=1):
                BookletItem.objects.create(
                    booklet=booklet,
                    question_version=question_version,
                    order=order,
                )

            self.stdout.write(
                self.style.SUCCESS(
                    f"Caderno criado: {booklet.name} ({items_count} itens)"
                )
            )

        # =====================================================
        # 7) OFFERS
        # =====================================================
        booklets = list(Booklet.objects.all().order_by("id"))
        if not booklets:
            self.stdout.write(
                self.style.WARNING("Nenhum caderno encontrado. Seed de ofertas não executado.")
            )
            self.stdout.write(
                self.style.SUCCESS("Seed ok (usuarios + curriculo + questoes + cadernos)")
            )
            return

        today = timezone.localdate()
        offer_templates = [
            # aberta
            {"start_offset": -3, "end_offset": 7, "description": "Oferta ativa de revisão semanal."},
            # em breve
            {"start_offset": 2, "end_offset": 12, "description": "Oferta programada para próxima semana."},
            # encerrada
            {"start_offset": -20, "end_offset": -5, "description": "Oferta encerrada do ciclo anterior."},
        ]

        created_offers = 0
        for index, booklet in enumerate(booklets):
            template = offer_templates[index % len(offer_templates)]
            owner = random.choice(seed_users)
            Offer.objects.create(
                booklet=booklet,
                start_date=today + timedelta(days=template["start_offset"]),
                end_date=today + timedelta(days=template["end_offset"]),
                description=template["description"],
                deleted=False,
                created_by=owner.id,
            )
            created_offers += 1

        self.stdout.write(
            self.style.SUCCESS(f"Ofertas criadas: {created_offers}")
        )

        self.stdout.write(
            self.style.SUCCESS("Seed ok (usuarios + curriculo + questoes + cadernos + ofertas)")
        )
