import os
import uuid
from django.conf import settings
from django.db import models
from django.db.models import UniqueConstraint, Index

def rename_upload_question(self, filename):
    file_name, file_extension = os.path.splitext(filename)
    filename = "%s%s" % (uuid.uuid4(), file_extension)

    return os.path.join('upload/', filename)

def rename_upload_answer(self, filename):
    file_name, file_extension = os.path.splitext(filename)
    filename = "%s%s" % (uuid.uuid4(), file_extension)

    return os.path.join('upload_answer/', filename)

class Subject(models.Model):
    """
    Model para Disciplina
    """
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class Topic(models.Model):
    """
    Model para Tópico
    """
    description = models.TextField()
    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, null=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["subject", "description"],
                name="uq_topic_subject_description"
            )
        ]

    def __str__(self):
        return self.description

class Descriptor(models.Model):
    """
    Model para Saber(antigo Descritor)
    """
    name = models.TextField(unique=True)
    code = models.CharField(max_length=10, unique=True)
    topic = models.ForeignKey(Topic, on_delete=models.PROTECT, null=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["topic", "code"],
                name="uq_descriptor_topic_code"
            )
        ]
    
    def __str__(self):
        return f"{self.code} - {self.name}"
    
class Skill(models.Model):
    """
    Model para Habilidade
    """
    name = models.TextField(unique=True)
    code = models.CharField(max_length=10, unique=True)
    descriptor = models.ForeignKey(Descriptor, on_delete=models.PROTECT, related_name="skills")

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["descriptor", "code"],
                name="uq_skill_descriptor_code"
            )
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"
    
class LegacyMap(models.Model):
    """
    Tabela de importação de scripts do SISEDU para o SISEDU_ESCOLA
    """

    TYPE_CHOICES = [
        ("SUBJECT", "Subject"),
        ("TOPIC", "Topic"),
        ("DESCRIPTOR", "Descriptor"),
        ("SKILL", "Skill"),
    ]

    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    legacy_id = models.BigIntegerField(null=True, blank=True)
    legacy_raw = models.CharField(max_length=400)

    legacy_code = models.CharField(max_length=30, blank=True, default="")
    legacy_name = models.CharField(max_length=255, blank=True, default="")

    status = models.CharField(max_length=20, default="OK")

    subject = models.ForeignKey(Subject, null=True, blank=True, on_delete=models.CASCADE)
    topic = models.ForeignKey(Topic, null=True, blank=True, on_delete=models.CASCADE)
    descriptor = models.ForeignKey(Descriptor, null=True, blank=True, on_delete=models.CASCADE)
    skill = models.ForeignKey(Skill, null=True, blank=True, on_delete=models.CASCADE)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["type", "legacy_raw"],
                name="uq_legacy_type_raw"
            )
        ]

    def __str__(self):
        return f"{self.type} - {self.legacy_raw}"

class Question(models.Model):
    """
    Model para Perguntas
    """
    private = models.BooleanField(default=False)
    deleted = models.BooleanField(default=False)
    created_by = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Questão {self.id}"
    
class QuestionVersion(models.Model):
    question = models.ForeignKey(Question, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()

    title = models.TextField()
    support_text = models.TextField(null=True)
    support_image = models.FileField(upload_to=rename_upload_question, null=True)
    image_reference = models.CharField(max_length=500, null=True)
    command = models.TextField()

    subject = models.ForeignKey(Subject, on_delete=models.PROTECT, related_name="subjects")
    descriptor = models.ForeignKey(Descriptor, on_delete=models.PROTECT, null=True, related_name="sages")
    skill = models.ForeignKey(Skill, on_delete=models.PROTECT, null=True, related_name="skills")
    annulled = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["question", "version_number"],
                name="uq_question_version"
            )
        ]

    def __str__(self):
        return f"Q{self.question_id}.v{self.version_number}"
        
class QuestionOption(models.Model):
    """
    Model para Respostas
    """
    question_version = models.ForeignKey(QuestionVersion, on_delete=models.PROTECT, related_name="options")
    letter = models.CharField(max_length=1)
    option_text = models.TextField(null=True)
    option_image = models.FileField(upload_to=rename_upload_answer, null=True)
    correct = models.BooleanField(null=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["question_version", "letter"],
                name="uq_version_letter"
            )
        ]

    def get_option(self):
        return f"{self.letter} -  {self.option_text}"
    
    def __str__(self):
        # return f"{self.option_text}"
        return f"{self.letter} ({'✔' if self.correct else ''})"

class Booklet(models.Model):
    """
    Model para Caderno
    """
    name = models.CharField(max_length=150)
    deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.BigIntegerField()

    def __str__(self):
        return self.name
    
class BookletItem(models.Model):
    booklet = models.ForeignKey(Booklet, on_delete=models.PROTECT, related_name="items")
    question_version = models.ForeignKey(QuestionVersion, on_delete=models.PROTECT)
    order = models.PositiveIntegerField()

    class Meta:
        constraints = [
            UniqueConstraint(fields=["booklet", "order"], name="uq_booklet_order"),
            UniqueConstraint(fields=["booklet", "question_version"], name="uq_booklet_version"),
        ]

    def __str__(self):
        return f"{self.booklet} #{self.order}"
    
class Offer(models.Model):
    booklet = models.ForeignKey(Booklet, on_delete=models.PROTECT)
    start_date = models.DateField()
    end_date = models.DateField()
    description = models.CharField(max_length=500, null=True, blank=True)
    deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.BigIntegerField()

    def __str__(self):
        return f"Oferta {self.id}"


class Application(models.Model):
    """
    Model para Aplicação(antigo ALuno SISEDU)
    """
    offer = models.ForeignKey(Offer, on_delete=models.PROTECT)
    class_ref = models.BigIntegerField() # id da Turma no SIGE
    student_ref = models.BigIntegerField() # id do Aluno no SIGE
    student_absent = models.BooleanField(default=False) # Ausencia do aluno
    finalized_at = models.DateTimeField(null=True, blank=True)
    finalized_by = models.BigIntegerField(null=True, blank=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["offer", "class_ref", "student_ref"],
                name="uq_application_unique"
            )
        ]

    def __str__(self):
        return f"Aplicação {self.id}"

class StudentAnswer(models.Model):
    application = models.ForeignKey(Application, on_delete=models.PROTECT, related_name="answers")
    booklet_item = models.ForeignKey(BookletItem, on_delete=models.PROTECT)
    selected_option = models.CharField(max_length=1, null=True, blank=True)
    is_correct = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            UniqueConstraint(
                fields=["application", "booklet_item"],
                name="uq_answer_unique"
            )
        ]
        indexes = [
            Index(fields=["application"]),
            Index(fields=["booklet_item"]),
            Index(fields=["is_correct"]),
        ]

    def __str__(self):
        return f"Resposta {self.application_id} - Item {self.booklet_item_id}"


class ChatConversation(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_conversations")
    started_at = models.DateTimeField(auto_now_add=True)
    last_interaction = models.DateTimeField(auto_now=True)
    current_step = models.CharField(max_length=50, default="start")
    fallback_count = models.PositiveSmallIntegerField(default=0)

    class Meta:
        indexes = [
            Index(fields=["user", "-last_interaction"]),
        ]

    def __str__(self):
        return f"Conversa {self.id} (user={self.user_id})"


class ChatMessage(models.Model):
    SENDER_USER = "user"
    SENDER_BOT = "bot"
    SENDER_CHOICES = [
        (SENDER_USER, "Usuário"),
        (SENDER_BOT, "Bot"),
    ]

    conversation = models.ForeignKey(ChatConversation, on_delete=models.CASCADE, related_name="messages")
    sender = models.CharField(max_length=10, choices=SENDER_CHOICES)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            Index(fields=["conversation", "created_at"]),
        ]

    def __str__(self):
        return f"Msg {self.id} ({self.sender}) conv={self.conversation_id}"
