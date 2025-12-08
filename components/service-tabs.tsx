"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Scissors,
  Film,
  BarChart3,
  ArrowRight,
  Clock,
  Zap,
  Target,
  MessageSquare,
  LineChart,
} from "lucide-react"

const services = [
  {
    id: "shorts",
    title: "쇼츠",
    icon: Scissors,
    description: "빠르고 강력한 쇼츠 편집 도구로 바이럴 콘텐츠를 만들어보세요",
    features: ["AI 자동 편집", "트렌드 분석", "최적화된 비율"],
    url: "https://wingsedit.vercel.app/",
    available: true,
    color: "from-primary/20 to-accent/20",
  },
  {
    id: "longform",
    title: "롱폼",
    icon: Film,
    description: "AI 기반 롱폼 영상 제작으로 전문적인 콘텐츠를 만들어보세요",
    features: ["AI 대본 생성", "인물 캐릭터 생성", "자동 영상 제작"],
    url: "/longform",
    available: true,
    color: "from-primary/20 to-accent/20",
  },
  {
    id: "analytics",
    title: "유튜브 분석",
    icon: BarChart3,
    description: "데이터 기반 인사이트로 채널 성장을 가속화하세요",
    features: ["실시간 분석", "성장 예측", "경쟁사 분석"],
    url: "/youtube-analytics",
    available: true,
    color: "from-primary/20 to-accent/20",
  },
  {
    id: "chatbot",
    title: "윙스AI 1:1봇",
    icon: MessageSquare,
    description: "유튜브 관련 질문에 AI가 1:1로 답변해드립니다",
    features: ["실시간 답변", "전문 조언", "24/7 지원"],
    url: "/wings-chatbot",
    available: true,
    color: "from-green-500/20 to-teal-500/20",
  },
  {
    id: "youtube-trends",
    title: "유튜브 실시간 분석",
    icon: LineChart,
    description: "Google Trends 기반으로 YouTube 키워드 트렌드를 실시간 분석합니다",
    features: ["키워드 트렌드", "검색량 분석", "관련 키워드"],
    url: "/youtube-trends",
    available: true,
    color: "from-purple-500/20 to-pink-500/20",
  },
]

export function ServiceTabs() {
  const [activeTab, setActiveTab] = useState("shorts")

  const handleServiceClick = (service: (typeof services)[0]) => {
    if (service.available && service.url !== "#") {
      if (service.url.startsWith("http")) {
        window.open(service.url, "_blank")
      } else {
        window.location.href = service.url
      }
    }
  }

  return (
    <section className="py-24 bg-gradient-to-b from-background to-muted/30 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-10 left-1/4 w-32 h-32 bg-primary/5 rounded-full animate-pulse"
          style={{ animationDuration: "6s" }}
        />
        <div
          className="absolute bottom-20 right-1/3 w-24 h-24 bg-blue-500/5 rounded-full animate-bounce"
          style={{ animationDelay: "2s", animationDuration: "4s" }}
        />
        <div
          className="absolute top-1/2 right-10 w-16 h-16 bg-green-500/5 rounded-full animate-spin"
          style={{ animationDuration: "15s" }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
            {"모든 영상 제작 도구를"}
            <span
              className="text-primary block animate-bounce"
              style={{ animationDelay: "1s", animationDuration: "3s" }}
            >
              {"한 곳에서"}
            </span>
          </h2>
          <p
            className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty animate-slide-up"
            style={{ animationDelay: "0.5s" }}
          >
            {"쇼츠부터 롱폼, 분석까지 - 당신의 창작 여정을 완벽하게 지원합니다"}
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {services.map((service, index) => {
            const Icon = service.icon
            return (
              <button
                key={service.id}
                onClick={() => setActiveTab(service.id)}
                className={`flex items-center gap-3 px-6 py-3 rounded-full transition-all duration-300 animate-fade-in hover:animate-pulse ${
                  activeTab === service.id
                    ? "bg-primary text-primary-foreground shadow-lg scale-105"
                    : "bg-card hover:bg-card/80 text-card-foreground hover:scale-102"
                }`}
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <Icon
                  className={`w-5 h-5 ${activeTab === service.id ? "animate-spin" : ""}`}
                  style={{ animationDuration: "2s" }}
                />
                <span className="font-medium">{service.title}</span>
              </button>
            )
          })}
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
          {services.map((service, index) => {
            const Icon = service.icon
            const isActive = activeTab === service.id

            return (
              <Card
                key={service.id}
                className={`relative overflow-hidden transition-all duration-500 hover:shadow-2xl group cursor-pointer animate-fade-in hover:animate-pulse ${
                  isActive ? "ring-2 ring-primary shadow-xl scale-105" : "hover:scale-102"
                } ${!service.available ? "opacity-60" : ""}`}
                onClick={() => handleServiceClick(service)}
                style={{ animationDelay: `${index * 0.3}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${service.color} opacity-50`} />

                <CardContent className="relative p-8 h-full flex flex-col">
                  <div className="flex items-center gap-4 mb-6">
                    <div
                      className={`p-3 rounded-xl transition-all duration-300 ${
                        service.available
                          ? "bg-primary text-primary-foreground animate-pulse"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className={`w-8 h-8 ${isActive ? "animate-bounce" : ""}`} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold">{service.title}</h3>
                      {!service.available && <span className="text-sm text-muted-foreground">{"곧 출시 예정"}</span>}
                    </div>
                  </div>

                  <p className="text-muted-foreground mb-6 text-pretty leading-relaxed flex-grow">
                    {service.description}
                  </p>

                  <div className="space-y-3 mb-6">
                    {service.features.map((feature, index) => (
                      <div key={index} className="flex items-center gap-3">
                        {service.available ? (
                          <Zap className="w-4 h-4 text-accent" />
                        ) : (
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Button
                    className={`w-full group-hover:scale-105 transition-all duration-300 hover:animate-bounce ${
                      !service.available ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    variant={service.available ? "default" : "secondary"}
                    disabled={!service.available}
                  >
                    {service.available ? (
                      <>
                        {"시작하기"}
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform animate-pulse" />
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4 mr-2 animate-spin" style={{ animationDuration: "3s" }} />
                        {"준비 중"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
