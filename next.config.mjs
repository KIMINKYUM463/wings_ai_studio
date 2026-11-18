/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static", "@google/genai"],
  experimental: {
    serverComponentsExternalPackages: ["ffmpeg-static", "ffprobe-static", "@google/genai"],
    serverActions: {
      bodySizeLimit: "50mb",
    },
    // process.cwd()+public 경로 때문에 public 전체가 함수에 딸려 들어가 Vercel 250MB 한도를 넘음 → 디스크에서 안 읽는 큰 미디어 제외
    outputFileTracingExcludes: Object.fromEntries(
      ["/api/wings-shopping-v2/**", "/api/ai-shopping/render-pro/**", "/api/shotform/auto-edit/**", "/api/shotform/auto-edit"].map((r) => [
        r,
        [
          "./public/samples/**",
          "./public/shotform/**",
          "./public/thumbnail-studio/**",
          "./public/scene-style-samples/**",
          "./public/remix-home/**",
          "./public/hq-avatars/**",
          "./public/animal-shopping/**",
          "./public/story-shopping-sfx/**",
          "./public/wings-ssul-bgm/**",
          "./data/**",
          "./.tmp/**",
          // 폰트는 디스크에서 안 읽음(자동편집), ffprobe 는 vendor/ 사본을 씀 (lib/ffmpeg-binaries.ts)
          "./public/fonts/**",
          "./node_modules/ffprobe-static/bin/**",
        ],
      ])
    ),
  },
  outputFileTracingIncludes: {
    "/api/shotform/auto-edit": [
      "./vendor/ffmpeg/**",
      "./vendor/ffprobe/**",
      "./node_modules/ffmpeg-static/**",
      "./node_modules/ffprobe-static/**",
    ],
    "/api/shotform/auto-edit/download": ["./vendor/ffmpeg/**", "./vendor/ffprobe/**"],
    "/*": ["./vendor/ffmpeg/**", "./vendor/ffprobe/**"],
  },
  async redirects() {
    return [
      // v2 는 로컬 전용 → 배포판에서는 예전 버전으로 보낸다
      ...(process.env.VERCEL
        ? [
            { source: "/WingsAIStudioShotForm/story-shopping-v2", destination: "/WingsAIStudioShotForm/story-shopping", permanent: false },
            { source: "/WingsAIStudioShotForm/story-shopping-v2/:path*", destination: "/WingsAIStudioShotForm/story-shopping", permanent: false },
            { source: "/WingsAIStudioShotForm/remix-shopping-v2", destination: "/WingsAIStudioShotForm/shortform-studio", permanent: false },
            { source: "/WingsAIStudioShotForm/remix-shopping-v2/:path*", destination: "/WingsAIStudioShotForm/shortform-studio", permanent: false },
          ]
        : []),
      {
        source: "/WingsAIStudioShotForm/shopping-factory/:path*",
        destination: "/WingsAIStudioShotForm/shoppingshotform/:path*",
        permanent: true,
      },
      {
        source: "/WingsAIStudioShotForm/shoppingshotform/s/:slug",
        destination: "/WingsAIStudioShotForm/shoppingshotform/shopping/:slug",
        permanent: true,
      },
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = config.externals || []
      const extra = ["undici", "ffmpeg-static", "ffprobe-static"]
      if (Array.isArray(config.externals)) {
        config.externals.push(...extra)
      } else {
        config.externals = [config.externals, ...extra]
      }
    } else {
      // opencv.js(PaddleOCR 의존성)의 Node 전용 분기 — 브라우저 번들에서는 사용 안 함
      config.resolve.fallback = { ...config.resolve.fallback, fs: false, path: false, crypto: false }
    }
    return config
  },
  // 환경 변수 설정
  env: {
    // 배포판에서 로컬 전용(v2) 기능을 숨기는 데 씀
    NEXT_PUBLIC_IS_VERCEL: process.env.VERCEL ? "1" : "",
    CLOUD_RUN_RENDER_URL: 'https://my-project-gs3pokkvsa-an.a.run.app',
    // 클라이언트에서 Cloud Run 직접 호출을 위한 환경 변수 (NEXT_PUBLIC_ 접두사 필요)
    NEXT_PUBLIC_CLOUD_RUN_RENDER_URL: 'https://my-project-gs3pokkvsa-an.a.run.app',
    // CLOUD_RUN_AUTH_TOKEN: 'your-auth-token-here', // 인증이 필요한 경우 주석 해제
    // Cloud Storage 환경 변수 (next.config.mjs에서 직접 설정)
    GOOGLE_CLOUD_PROJECT_ID: 'test-ai-450613',
    GOOGLE_CLOUD_STORAGE_BUCKET: 'video-renderer-storage',
    // 카카오 로그인 환경 변수 (마이수파코드 앱)
    KAKAO_REST_API_KEY: '29e0cf48de7d7a8fecec3d729db037d6',
    KAKAO_CLIENT_SECRET: 'JHpR3y0b1QQoxS0MaomVcGFfXzHfdMEi',
  },
}

export default nextConfig
