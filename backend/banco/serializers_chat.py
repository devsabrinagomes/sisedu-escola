from rest_framework import serializers

from .models import ChatConversation, ChatMessage


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ["id", "sender", "text", "created_at"]


class ChatConversationSerializer(serializers.ModelSerializer):
    messages = serializers.SerializerMethodField()

    class Meta:
        model = ChatConversation
        fields = [
            "id",
            "started_at",
            "last_interaction",
            "current_step",
            "fallback_count",
            "messages",
        ]

    def get_messages(self, obj):
        qs = obj.messages.order_by("-created_at")[:50]
        messages = list(reversed(qs))
        return ChatMessageSerializer(messages, many=True).data


class ChatSendSerializer(serializers.Serializer):
    conversation_id = serializers.IntegerField(required=False)
    text = serializers.CharField(required=True, allow_blank=False, max_length=4000)

    def validate_text(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError("A mensagem não pode ser vazia.")
        return cleaned
