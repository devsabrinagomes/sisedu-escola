from rest_framework import serializers

from .models import StudentAnswer

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


class ReportByClassRowSerializer(serializers.Serializer):
    class_id = serializers.IntegerField()
    class_name = serializers.CharField()
    total_students = serializers.IntegerField()
    accuracy_percent = serializers.FloatField()
    absent_count = serializers.IntegerField()
    absent_percent = serializers.FloatField()
