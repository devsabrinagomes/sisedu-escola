import { MessageCircle, Send, X } from "lucide-react"
import { FormEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from "react"

import { useAuth } from "@/auth/AuthContext"
import EqualizerLoader from "@/components/ui/EqualizerLoader"
import {
  ChatButtonDTO,
  ChatMessageDTO,
  getChatConversation,
  sendChatMessage,
} from "@/features/chat/services/chat"

const SUPPORT_PHONE = "558836951962"

type ChatUiMessage = {
  id: number
  sender: "user" | "bot"
  text: string
  created_at: string
}

function nowIso() {
  return new Date().toISOString()
}

function protocolFromConversationId(conversationId?: number) {
  return `CHAT-${String(conversationId || 0).padStart(6, "0")}`
}

function buildFallbackWhatsAppLink(conversationId: number | undefined, lastText: string) {
  const protocol = protocolFromConversationId(conversationId)
  const message = `Oi! Preciso de ajuda no Sisedu Escola. Protocolo: ${protocol}. Última mensagem: ${lastText}.`
  return `https://wa.me/${SUPPORT_PHONE}?text=${encodeURIComponent(message)}`
}

function normalizeMessages(messages: ChatMessageDTO[]): ChatUiMessage[] {
  return messages.map((item) => ({
    id: item.id,
    sender: item.sender,
    text: item.text,
    created_at: item.created_at,
  }))
}

export default function ChatWidget() {
  const { userId } = useAuth()
  const conversationStorageKey = useMemo(
    () => `chat_conversation_id_${userId || "default"}`,
    [userId],
  )

  const [open, setOpen] = useState(false)
  const [conversationId, setConversationId] = useState<number | undefined>()
  const [messages, setMessages] = useState<ChatUiMessage[]>([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(false)
  const [buttons, setButtons] = useState<ChatButtonDTO[]>([])
  const [isHydratingConversation, setIsHydratingConversation] = useState(false)

  const endRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
  const didInit = useRef(false)
  const tempMessageIdRef = useRef(-2)

  useEffect(() => {
    if (!open) return

    let cancelled = false
    const stored = localStorage.getItem(conversationStorageKey)
    const parsed = stored ? Number(stored) : NaN

    if (!stored || Number.isNaN(parsed) || parsed <= 0) {
      setConversationId(undefined)
      setMessages([])
      setButtons([])
      setIsHydratingConversation(false)
      return
    }

    setIsHydratingConversation(true)
    setConversationId(parsed)

    getChatConversation(parsed)
      .then((data) => {
        if (cancelled) return
        setMessages(normalizeMessages(data.messages))
      })
      .catch(() => {
        if (cancelled) return
        localStorage.removeItem(conversationStorageKey)
        setConversationId(undefined)
        setMessages([])
      })
      .finally(() => {
        if (!cancelled) setIsHydratingConversation(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, conversationStorageKey])

  useEffect(() => {
    if (!open || conversationId || isHydratingConversation || didInit.current) return
    didInit.current = true
    void sendMessage("__init__", { optimisticUserMessage: false, fallbackMessageRef: "início da conversa" })
  }, [open, conversationId, isHydratingConversation])

  useEffect(() => {
    if (!open) {
      didInit.current = false
    }
  }, [open])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, loading, buttons])

  useEffect(() => {
    document.body.classList.toggle("chat-open", open)
    return () => {
      document.body.classList.remove("chat-open")
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(() => {
      inputRef.current?.focus()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [open])

  async function sendMessage(
    payloadText: string,
    options?: { optimisticUserMessage?: boolean; fallbackMessageRef?: string },
  ) {
    if (!payloadText.trim() || loading) return

    const optimisticUserMessage = options?.optimisticUserMessage ?? true
    const fallbackMessageRef = options?.fallbackMessageRef || payloadText

    if (optimisticUserMessage) {
      const optimisticMessage: ChatUiMessage = {
        id: tempMessageIdRef.current,
        sender: "user",
        text: payloadText,
        created_at: nowIso(),
      }
      tempMessageIdRef.current -= 1
      setMessages((prev) => [...prev, optimisticMessage])
      setText("")
    }

    setButtons([])
    setLoading(true)

    try {
      const response = await sendChatMessage(payloadText, conversationId)
      const nextConversationId = response.conversation_id

      if (!conversationId) {
        setConversationId(nextConversationId)
        localStorage.setItem(conversationStorageKey, String(nextConversationId))
      }

      if (response.messages && response.messages.length > 0) {
        setMessages(normalizeMessages(response.messages))
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: tempMessageIdRef.current,
            sender: "bot",
            text: response.reply,
            created_at: nowIso(),
          },
        ])
        tempMessageIdRef.current -= 1
      }

      setButtons(response.buttons || [])
    } catch (error: any) {
      const backendButtons = Array.isArray(error?.response?.data?.buttons)
        ? (error.response.data.buttons as ChatButtonDTO[])
        : []
      const backendProtocol = error?.response?.data?.meta?.protocol as string | undefined
      const protocolConversationId =
        backendProtocol && /^CHAT-\d{6}$/.test(backendProtocol)
          ? Number(backendProtocol.replace("CHAT-", ""))
          : conversationId
      const fallbackLink = buildFallbackWhatsAppLink(protocolConversationId, fallbackMessageRef)
      setMessages((prev) => [
        ...prev,
        {
          id: tempMessageIdRef.current,
          sender: "bot",
          text: "Tive um problema para responder. Quer falar com o suporte?",
          created_at: nowIso(),
        },
      ])
      tempMessageIdRef.current -= 1
      setButtons(
        backendButtons.length > 0
          ? backendButtons
          : [{ label: "Falar no WhatsApp do suporte", url: fallbackLink }],
      )
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = text.trim()
    if (!trimmed) return
    void sendMessage(trimmed, { optimisticUserMessage: true, fallbackMessageRef: trimmed })
  }

  function handleInputKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      const trimmed = text.trim()
      if (!trimmed) return
      void sendMessage(trimmed, { optimisticUserMessage: true, fallbackMessageRef: trimmed })
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-4 z-30 inline-flex h-12 items-center gap-2 rounded-full border border-brand-600/40 bg-brand-600 px-4 text-white shadow-md transition hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
        aria-label={open ? "Fechar atendimento" : "Abrir atendimento"}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        <span className="text-sm font-semibold">{open ? "Fechar" : "Ajuda"}</span>
      </button>

      {open && (
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Atendimento"
          className="fixed bottom-24 right-4 z-30 flex h-[min(70vh,540px)] w-[min(92vw,380px)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-borderDark dark:bg-surface-1"
        >
          <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-borderDark">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Atendimento</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-surface-2"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-3 py-3 dark:bg-darkbg/40">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${
                    message.sender === "user"
                      ? "rounded-br-sm bg-brand-600 text-white"
                      : "rounded-bl-sm border border-slate-200 bg-white text-slate-800 dark:border-borderDark dark:bg-surface-2 dark:text-slate-100"
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-3 py-2 dark:border-borderDark dark:bg-surface-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-300">
                    <EqualizerLoader size={14} />
                    digitando...
                  </div>
                </div>
              </div>
            )}

            {buttons.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {buttons.map((button) => (
                  <a
                    key={`${button.label}-${button.url}`}
                    href={button.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center rounded-lg border border-emerald-600/50 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    {button.label}
                  </a>
                ))}
              </div>
            )}

            <div ref={endRef} />
          </div>

          <form onSubmit={handleSubmit} className="border-t border-slate-200 px-3 py-3 dark:border-borderDark">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={text}
                onChange={(event) => setText(event.target.value)}
                onKeyDown={handleInputKeyDown}
                rows={2}
                maxLength={4000}
                placeholder="Digite sua dúvida..."
                className="min-h-[40px] flex-1 resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-brand-500 dark:border-borderDark dark:bg-surface-2 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </form>
        </section>
      )}
    </>
  )
}
