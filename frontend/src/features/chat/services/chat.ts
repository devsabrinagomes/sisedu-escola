import { api } from "@/lib/api"

export type ChatSender = "user" | "bot"

export type ChatMessageDTO = {
  id: number
  sender: ChatSender
  text: string
  created_at: string
}

export type ChatButtonDTO = {
  label: string
  url: string
}

export type ChatSendResponseDTO = {
  conversation_id: number
  reply: string
  messages?: ChatMessageDTO[]
  buttons?: ChatButtonDTO[]
  meta?: {
    protocol?: string
  }
}

export type ChatConversationDTO = {
  id: number
  started_at: string
  last_interaction: string
  current_step: string
  fallback_count: number
  messages: ChatMessageDTO[]
}

export async function sendChatMessage(text: string, conversationId?: number) {
  const payload: { text: string; conversation_id?: number } = { text }
  if (conversationId) payload.conversation_id = conversationId

  const { data } = await api.post<ChatSendResponseDTO>("/chat/send/", payload)
  return data
}

export async function getChatConversation(conversationId: number) {
  const { data } = await api.get<ChatConversationDTO>(`/chat/conversation/${conversationId}/`)
  return data
}
