"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MessageSquare, Send, ArrowLeft, Home, Bot, User, Sparkles, Zap } from "lucide-react"
import Link from "next/link"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { sendChatMessage } from "./actions"

interface Message {
  role: "user" | "assistant"
  content: string
}

function ChatMarkdown({ content, tone = "assistant" }: { content: string; tone?: "assistant" | "user" }) {
  const isUser = tone === "user"
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className={`mb-2 mt-3 text-base font-bold first:mt-0 ${isUser ? "text-white" : "text-zinc-50"}`}>
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className={`mb-2 mt-3 text-[15px] font-bold first:mt-0 ${isUser ? "text-white" : "text-zinc-50"}`}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className={`mb-1.5 mt-2.5 text-sm font-semibold first:mt-0 ${isUser ? "text-white" : "text-emerald-100"}`}>
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className={`mb-1 mt-2 text-sm font-semibold first:mt-0 ${isUser ? "text-white" : "text-zinc-100"}`}>
            {children}
          </h4>
        ),
        p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
        strong: ({ children }) => (
          <strong className={`font-semibold ${isUser ? "text-white" : "text-emerald-200"}`}>{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-zinc-300">{children}</em>,
        ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>,
        ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>,
        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 text-cyan-300 hover:text-cyan-200"
          >
            {children}
          </a>
        ),
        code: ({ className, children }) => {
          const isBlock = Boolean(className)
          if (isBlock) {
            return (
              <code className="block overflow-x-auto rounded-lg bg-black/40 px-3 py-2 text-xs text-zinc-200">
                {children}
              </code>
            )
          }
          return (
            <code className="rounded bg-black/35 px-1.5 py-0.5 text-[12px] text-emerald-200">{children}</code>
          )
        },
        pre: ({ children }) => (
          <pre className="mb-2 overflow-x-auto rounded-lg border border-white/10 bg-black/40 p-0 last:mb-0">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="mb-2 border-l-2 border-emerald-400/40 pl-3 text-zinc-400 last:mb-0">
            {children}
          </blockquote>
        ),
        hr: () => <hr className="my-3 border-white/10" />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

export default function WingsChatbotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "안녕하세요! 윙스AI입니다. 유튜브 관련 질문이 있으시면 무엇이든 물어보세요. 채널 성장, 콘텐츠 기획, 편집 팁, 알고리즘 등 모든 것을 도와드립니다.",
    },
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput("")
    setMessages((prev) => [...prev, { role: "user", content: userMessage }])
    setIsLoading(true)

    try {
      const apiKey =
        typeof window !== "undefined"
          ? (localStorage.getItem("shotform_openai_api_key") || "").trim() || null
          : null
      if (!apiKey) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "OpenAI API 키가 설정되지 않았습니다. 메인 화면의 설정에서 API 키를 입력해주세요.",
          },
        ])
        return
      }

      const response = await sendChatMessage(userMessage, messages, apiKey)
      setMessages((prev) => [...prev, { role: "assistant", content: response }])
    } catch (error) {
      console.error("메시지 전송 실패:", error)
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "죄송합니다. 오류가 발생했습니다. 다시 시도해주세요." },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="wings-chat-page relative min-h-screen overflow-hidden bg-[#0a0b0d] text-zinc-100">
      {/* 배경 글로우 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-20 top-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl wings-chat-orb" />
        <div
          className="absolute -right-16 top-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl wings-chat-orb"
          style={{ animationDelay: "1.2s" }}
        />
        <div
          className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-500/8 blur-3xl wings-chat-orb"
          style={{ animationDelay: "2s" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.06),transparent_55%)]" />
      </div>

      <div className="relative z-10 container mx-auto max-w-4xl px-4 py-8">
        {/* 헤더 */}
        <div className="mb-8 flex items-start gap-4 wings-chat-header">
          <div className="flex gap-2 pt-1">
            <Link href="/WingsAIStudioShotForm">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10 hover:text-white"
                title="뒤로"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/WingsAIStudioShotForm">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 hover:bg-white/10 hover:text-white"
                title="홈"
              >
                <Home className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-emerald-200/90 uppercase">
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span className="wings-chat-ping absolute inset-0 rounded-full bg-emerald-400/40" />
                <Zap className="relative h-2.5 w-2.5 text-emerald-300" />
              </span>
              AI Assistant
            </div>
            <h1 className="flex items-center gap-3 text-3xl font-bold tracking-tight md:text-4xl">
              <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 shadow-lg shadow-emerald-500/25 ring-1 ring-white/20">
                <MessageSquare className="h-5 w-5 text-white" strokeWidth={1.75} />
                <span className="wings-chat-icon-glow absolute inset-0 rounded-2xl bg-emerald-400/30 blur-md" />
              </span>
              <span className="bg-gradient-to-r from-zinc-50 via-emerald-100 to-cyan-200 bg-clip-text text-transparent">
                윙스AI 1:1봇
              </span>
            </h1>
            <p className="mt-2 text-sm text-zinc-400 md:text-base">유튜브 전문가 AI와 1:1 상담</p>
          </div>
        </div>

        {/* 채팅 패널 */}
        <div className="wings-chat-panel overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0e0f12]/85 shadow-[0_0_60px_-20px_rgba(16,185,129,0.25)] backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 md:px-6">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-8 w-8 items-center justify-center">
                <span className="wings-chat-avatar-ring absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 to-cyan-400 opacity-40 blur-sm" />
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 ring-1 ring-white/20">
                  <Bot className="h-4 w-4 text-white" />
                </span>
              </span>
              <div>
                <p className="text-sm font-semibold text-zinc-100">채팅</p>
                <p className="flex items-center gap-1.5 text-[11px] text-emerald-300/80">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 wings-chat-online" />
                  온라인 · AI 응답 대기
                </p>
              </div>
            </div>
            <Sparkles className="h-4 w-4 text-emerald-300/70 wings-chat-sparkle" />
          </div>

          <div className="max-h-[min(600px,58vh)] space-y-4 overflow-y-auto px-4 py-5 md:px-6 md:py-6">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
                className={`flex gap-3 wings-chat-msg ${message.role === "user" ? "justify-end" : "justify-start"}`}
                style={{ animationDelay: `${Math.min(index, 6) * 40}ms` }}
              >
                {message.role === "assistant" && (
                  <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center">
                    <span className="wings-chat-avatar-ring absolute inset-0 rounded-full bg-emerald-400/25 blur-[6px]" />
                    <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600 ring-1 ring-white/15">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg ${
                    message.role === "user"
                      ? "rounded-br-md bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-emerald-900/30"
                      : "rounded-bl-md border border-white/[0.08] bg-white/[0.06] text-zinc-200 backdrop-blur-sm"
                  }`}
                >
                  <div className="wings-chat-markdown">
                    <ChatMarkdown content={message.content} tone={message.role} />
                  </div>
                </div>
                {message.role === "user" && (
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10">
                    <User className="h-4 w-4 text-zinc-300" />
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3 justify-start wings-chat-msg">
                <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center">
                  <span className="wings-chat-avatar-ring absolute inset-0 rounded-full bg-emerald-400/30 blur-[6px]" />
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-600">
                    <Bot className="h-4 w-4 text-white wings-chat-bot-think" />
                  </div>
                </div>
                <div className="rounded-2xl rounded-bl-md border border-emerald-400/20 bg-emerald-500/10 px-4 py-3.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-200/80">생각 중</span>
                    <div className="flex gap-1">
                      <span className="wings-chat-dot h-1.5 w-1.5 rounded-full bg-emerald-300" />
                      <span
                        className="wings-chat-dot h-1.5 w-1.5 rounded-full bg-emerald-300"
                        style={{ animationDelay: "0.18s" }}
                      />
                      <span
                        className="wings-chat-dot h-1.5 w-1.5 rounded-full bg-emerald-300"
                        style={{ animationDelay: "0.36s" }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div className="border-t border-white/[0.06] bg-black/20 p-4 md:p-5">
            <div className="flex gap-2.5">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="유튜브 관련 질문을 입력하세요..."
                disabled={isLoading}
                className="h-12 flex-1 rounded-xl border-white/10 bg-white/[0.05] text-zinc-100 placeholder:text-zinc-500 focus-visible:border-emerald-400/40 focus-visible:ring-emerald-500/20"
              />
              <Button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                size="icon"
                className="h-12 w-12 shrink-0 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/40 transition-all duration-300 hover:scale-[1.03] hover:from-emerald-400 hover:to-teal-500 disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="mt-2.5 text-center text-[11px] text-zinc-500">
              Enter로 전송 · AI 답변은 참고용이며 실제 운영 판단은 직접 확인해 주세요
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
