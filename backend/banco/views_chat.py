import json
import re
import unicodedata
from urllib import error as urllib_error
from urllib import parse as urllib_parse
from urllib import request as urllib_request

from django.conf import settings
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatConversation, ChatMessage
from .serializers_chat import ChatConversationSerializer, ChatSendSerializer


SUPPORT_PHONE = "558836951962"
HANDOFF_KEYWORDS = ("atendente", "humano", "suporte", "whatsapp")


def _normalize_text(value):
    normalized = unicodedata.normalize("NFKD", value or "")
    return "".join(char for char in normalized if not unicodedata.combining(char)).lower()


def _contains_handoff_keyword(text):
    normalized = _normalize_text(text)
    return any(re.search(rf"\b{keyword}\b", normalized) for keyword in HANDOFF_KEYWORDS)


def _build_protocol(conversation_id):
    return f"CHAT-{int(conversation_id):06d}"


def build_whatsapp_link(conversation_id, last_text):
    protocol = _build_protocol(conversation_id)
    message = (
        "Oi! Preciso de ajuda no Sisedu Escola. "
        f"Protocolo: {protocol}. "
        f"Última mensagem: {last_text}."
    )
    encoded = urllib_parse.quote(message)
    return f"https://wa.me/{SUPPORT_PHONE}?text={encoded}", protocol


def _build_handoff_response(conversation_id, last_text):
    wa_url, protocol = build_whatsapp_link(conversation_id, last_text)
    reply = (
        "Vou te direcionar para o suporte humano. "
        f"Seu protocolo é {protocol}."
    )
    buttons = [{"label": "Falar no WhatsApp do suporte", "url": wa_url}]
    return reply, buttons, protocol


def _call_n8n_chat(payload):
    webhook_url = str(getattr(settings, "N8N_CHAT_WEBHOOK_URL", "") or "").strip()
    if not webhook_url:
        raise ValueError("N8N_CHAT_WEBHOOK_URL não configurada.")

    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}

    token = str(getattr(settings, "N8N_TOKEN", "") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    req = urllib_request.Request(webhook_url, data=body, method="POST", headers=headers)

    with urllib_request.urlopen(req, timeout=10) as response:
        response_body = response.read().decode("utf-8")

    payload = json.loads(response_body or "{}")
    if not isinstance(payload, dict):
        raise ValueError("Resposta inválida do n8n.")
    return payload


class ChatSendView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChatSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        text = serializer.validated_data["text"]
        conversation_id = serializer.validated_data.get("conversation_id")
        is_init_message = text in ("__init__", "/start")

        if conversation_id:
            conversation = get_object_or_404(
                ChatConversation,
                id=conversation_id,
                user=request.user,
            )
        else:
            conversation = ChatConversation.objects.create(user=request.user)

        if not is_init_message:
            ChatMessage.objects.create(
                conversation=conversation,
                sender=ChatMessage.SENDER_USER,
                text=text,
            )

        reply = ""
        buttons = []
        next_step = None
        protocol = None
        should_handoff = (not is_init_message) and _contains_handoff_keyword(text)

        if should_handoff:
            reply, buttons, protocol = _build_handoff_response(conversation.id, text)
        else:
            payload = {
                "text": text,
                "userId": request.user.id,
                "conversationId": conversation.id,
                "currentStep": conversation.current_step,
                "fallbackCount": conversation.fallback_count,
            }

            try:
                n8n_response = _call_n8n_chat(payload)
                understood = n8n_response.get("understood")
                action = n8n_response.get("action")
                next_step = n8n_response.get("nextStep")

                if understood is False:
                    conversation.fallback_count += 1

                if action == "handoff_whatsapp" or conversation.fallback_count >= 2:
                    reply, buttons, protocol = _build_handoff_response(conversation.id, text)
                else:
                    reply = str(n8n_response.get("reply") or "Não consegui gerar uma resposta no momento.")
            except (
                urllib_error.URLError,
                urllib_error.HTTPError,
                json.JSONDecodeError,
                ValueError,
            ):
                reply, buttons, protocol = _build_handoff_response(conversation.id, text)
                reply = (
                    "Tive um problema para responder. "
                    f"{reply}"
                )

        if next_step:
            conversation.current_step = str(next_step)

        conversation.last_interaction = timezone.now()
        conversation.save(update_fields=["current_step", "fallback_count", "last_interaction"])

        ChatMessage.objects.create(
            conversation=conversation,
            sender=ChatMessage.SENDER_BOT,
            text=reply,
        )

        conversation_payload = ChatConversationSerializer(conversation).data

        response_data = {
            "conversation_id": conversation.id,
            "reply": reply,
            "messages": conversation_payload["messages"],
            "buttons": buttons,
        }
        if protocol:
            response_data["meta"] = {"protocol": protocol}

        return Response(response_data, status=status.HTTP_200_OK)


class ChatConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, id):
        conversation = get_object_or_404(ChatConversation, id=id, user=request.user)
        serializer = ChatConversationSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_200_OK)
