import random

from django.core.management.base import BaseCommand
from django.db import transaction
from django.contrib.auth import get_user_model

from banco.models import (
    Subject,
    Topic,
    Descriptor,
    Skill,
    Question,
    QuestionVersion,
    QuestionOption,
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
        # 4) LIMPA QUESTÕES ANTIGAS (SEED CONTROLADO)
        # =====================================================
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

        self.stdout.write(
            self.style.SUCCESS("Seed ok ✅ (usuários + currículo + questões)")
        )
