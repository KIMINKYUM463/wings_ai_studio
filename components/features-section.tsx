import { Card, CardContent } from "@/components/ui/card"
import { Bot, Zap, BarChart3, Video, Scissors, TrendingUp } from "lucide-react"

const features = [
  {
    icon: Bot,
    title: "AI 자동 편집",
    description: "인공지능이 자동으로 영상을 분석하고 최적의 편집점을 찾아 편집해드립니다.",
  },
  {
    icon: Scissors,
    title: "쇼츠 자동 생성",
    description: "롱폼 영상에서 하이라이트를 추출해 자동으로 쇼츠를 만들어줍니다.",
  },
  {
    icon: Video,
    title: "롱폼 최적화",
    description: "시청자 유지율을 높이는 편집 패턴을 AI가 학습하여 적용합니다.",
  },
  {
    icon: BarChart3,
    title: "실시간 분석",
    description: "유튜브 채널의 성과를 실시간으로 분석하고 개선점을 제안합니다.",
  },
  {
    icon: TrendingUp,
    title: "트렌드 예측",
    description: "AI가 트렌드를 분석해 다음에 만들어야 할 콘텐츠를 추천합니다.",
  },
  {
    icon: Zap,
    title: "원클릭 업로드",
    description: "편집 완료된 영상을 원클릭으로 유튜브에 자동 업로드합니다.",
  },
]

export function FeaturesSection() {
  return (
    <section className="py-24 bg-background relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-20 left-10 w-40 h-40 bg-primary/3 rounded-full animate-pulse"
          style={{ animationDuration: "8s" }}
        />
        <div
          className="absolute bottom-40 right-20 w-32 h-32 bg-blue-500/3 rounded-full animate-bounce"
          style={{ animationDelay: "3s", animationDuration: "6s" }}
        />
        <div
          className="absolute top-1/3 left-1/2 w-20 h-20 bg-green-500/3 rounded-full animate-spin"
          style={{ animationDuration: "20s" }}
        />
        <div
          className="absolute bottom-20 left-1/4 w-28 h-28 bg-purple-500/3 rounded-full animate-pulse"
          style={{ animationDelay: "1s", animationDuration: "5s" }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-balance">
            {"AI 자동화로"}
            <span
              className="text-primary block animate-bounce"
              style={{ animationDelay: "1s", animationDuration: "4s" }}
            >
              {"이런 것들이 가능해요"}
            </span>
          </h2>
          <p
            className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty animate-slide-up"
            style={{ animationDelay: "0.5s" }}
          >
            {"복잡한 영상 편집과 분석 작업을 AI가 대신 처리해주는 완전 자동화 시스템입니다"}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <Card
                key={index}
                className="group hover:shadow-lg transition-all duration-500 hover:scale-105 animate-fade-in hover:animate-pulse"
                style={{ animationDelay: `${index * 0.2}s` }}
              >
                <CardContent className="p-8 text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300 animate-pulse">
                    <Icon
                      className="w-8 h-8 group-hover:animate-spin transition-all duration-300"
                      style={{ animationDuration: "2s" }}
                    />
                  </div>
                  <h3 className="text-xl font-bold mb-4 group-hover:animate-bounce">{feature.title}</h3>
                  <p className="text-muted-foreground text-pretty leading-relaxed">{feature.description}</p>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}
