import { Button } from "@/components/ui/button"
import { Play, Bot, Youtube } from "lucide-react"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-card to-muted overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-20 left-10 w-20 h-20 bg-primary/10 rounded-full animate-bounce"
          style={{ animationDelay: "0s", animationDuration: "3s" }}
        />
        <div
          className="absolute top-40 right-20 w-16 h-16 bg-blue-500/10 rounded-full animate-bounce"
          style={{ animationDelay: "1s", animationDuration: "4s" }}
        />
        <div
          className="absolute bottom-40 left-20 w-12 h-12 bg-green-500/10 rounded-full animate-bounce"
          style={{ animationDelay: "2s", animationDuration: "5s" }}
        />
        <div
          className="absolute bottom-20 right-10 w-24 h-24 bg-purple-500/10 rounded-full animate-bounce"
          style={{ animationDelay: "0.5s", animationDuration: "3.5s" }}
        />

        {/* 회전하는 원형 요소들 */}
        <div
          className="absolute top-1/4 left-1/4 w-32 h-32 border-2 border-primary/20 rounded-full animate-spin"
          style={{ animationDuration: "20s" }}
        />
        <div
          className="absolute bottom-1/4 right-1/4 w-40 h-40 border-2 border-blue-500/20 rounded-full animate-spin"
          style={{ animationDuration: "25s", animationDirection: "reverse" }}
        />

        {/* 펄스 효과 */}
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full animate-pulse"
          style={{ animationDuration: "4s" }}
        />
      </div>

      {/* Background decoration */}
      <div className="absolute inset-0 bg-[url('/abstract-video-editing-workspace.jpg')] bg-cover bg-center opacity-5" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-background/40" />

      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium animate-pulse">
            <Bot className="w-4 h-4 animate-spin" style={{ animationDuration: "3s" }} />
            {"AI 유튜브 자동화 시스템"}
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-balance leading-tight animate-fade-in">
            {"AI로 만드는"}
            <span
              className="text-primary block animate-bounce"
              style={{ animationDelay: "1s", animationDuration: "2s" }}
            >
              {"유튜브 자동화"}
            </span>
          </h1>

          <p
            className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-pretty leading-relaxed animate-slide-up"
            style={{ animationDelay: "0.5s" }}
          >
            {"쇼츠 제작부터 롱폼 편집, 유튜브 분석까지. AI가 도와주는 완전 자동화 시스템을 배워보세요."}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Button
              size="lg"
              className="text-lg px-8 py-6 h-auto animate-pulse hover:animate-bounce transition-all duration-300 hover:scale-105"
            >
              <Play className="w-5 h-5 mr-2 animate-spin" style={{ animationDuration: "2s" }} />
              {"시스템 체험하기"}
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6 h-auto bg-transparent hover:animate-pulse transition-all duration-300 hover:scale-105"
            >
              <Youtube className="w-5 h-5 mr-2 animate-bounce" />
              {"사용법 보기"}
            </Button>
          </div>

          <div className="grid grid-cols-3 gap-8 pt-12 max-w-2xl mx-auto">
            <div className="text-center animate-fade-in" style={{ animationDelay: "1s" }}>
              <div className="text-3xl font-bold text-primary animate-pulse">{"100+"}</div>
              <div className="text-sm text-muted-foreground">{"수강생"}</div>
            </div>
            <div className="text-center animate-fade-in" style={{ animationDelay: "1.2s" }}>
              <div className="text-3xl font-bold text-primary animate-pulse" style={{ animationDelay: "0.5s" }}>
                {"24/7"}
              </div>
              <div className="text-sm text-muted-foreground">{"AI 자동화"}</div>
            </div>
            <div className="text-center animate-fade-in" style={{ animationDelay: "1.4s" }}>
              <div className="text-3xl font-bold text-primary animate-pulse" style={{ animationDelay: "1s" }}>
                {"3가지"}
              </div>
              <div className="text-sm text-muted-foreground">{"핵심 도구"}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
