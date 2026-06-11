/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["ffmpeg-static", "ffprobe-static"],
  experimental: {
    serverComponentsExternalPackages: ["ffmpeg-static", "ffprobe-static"],
    serverActions: {
      bodySizeLimit: "50mb",
    },
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
    }
    return config
  },
  // 환경 변수 설정
  env: {
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
