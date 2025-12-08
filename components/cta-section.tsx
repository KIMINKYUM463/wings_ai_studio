import { Button } from "@/components/ui/button"
import { ArrowRight, GraduationCap } from "lucide-react"

export function CTASection() {
  return (
    <section className="py-24 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="absolute top-20 left-20 w-64 h-64 bg-primary/3 rounded-full animate-pulse"
          style={{ animationDuration: "10s" }}
        />
        <div
          className="absolute bottom-20 right-20 w-48 h-48 bg-accent/3 rounded-full animate-bounce"
          style={{ animationDelay: "2s", animationDuration: "8s" }}
        />
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-primary/2 to-accent/2 rounded-full animate-spin"
          style={{ animationDuration: "30s" }}
        />
        <div
          className="absolute top-40 right-1/4 w-32 h-32 bg-blue-500/3 rounded-full animate-pulse"
          style={{ animationDelay: "4s", animationDuration: "6s" }}
        />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/20 text-accent text-sm font-medium mb-8 animate-pulse">
            <GraduationCap className="w-4 h-4 animate-bounce" />
            {"수강생 전용 시스템"}
          </div>

          <h2 className="text-4xl md:text-6xl font-bold mb-6 text-balance animate-fade-in">
            {"AI 자동화 마스터가"}
            <span
              className="text-primary block animate-bounce"
              style={{ animationDelay: "1s", animationDuration: "3s" }}
            >
              {"되어보세요"}
            </span>
          </h2>

          <p
            className="text-xl text-muted-foreground mb-12 max-w-2xl mx-auto text-pretty animate-slide-up"
            style={{ animationDelay: "0.5s" }}
          >
            {
              "이 시스템을 통해 유튜브 채널 운영의 모든 과정을 자동화하고, AI의 힘으로 더 효율적인 크리에이터가 되어보세요."
            }
          </p>

          <div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-fade-in"
            style={{ animationDelay: "1s" }}
          >
            <Button
              size="lg"
              className="text-lg px-8 py-6 h-auto group animate-pulse hover:animate-bounce transition-all duration-300 hover:scale-110"
            >
              {"시스템 사용해보기"}
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform animate-pulse" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-lg px-8 py-6 h-auto bg-transparent hover:animate-pulse transition-all duration-300 hover:scale-105"
            >
              {"사용법 배우기"}
            </Button>
          </div>

          <div
            className="flex items-center justify-center gap-8 mt-12 text-sm text-muted-foreground animate-fade-in"
            style={{ animationDelay: "1.5s" }}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse"></div>
              {"수강생 전용"}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0.5s" }}></div>
              {"24시간 이용 가능"}
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-accent rounded-full animate-pulse" style={{ animationDelay: "1s" }}></div>
              {"지속적 업데이트"}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
