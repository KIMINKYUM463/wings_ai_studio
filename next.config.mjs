/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // 환경 변수 설정
  env: {
    CLOUD_RUN_RENDER_URL: 'https://my-project-350911437561.asia-northeast1.run.app',
    // CLOUD_RUN_AUTH_TOKEN: 'your-auth-token-here', // 인증이 필요한 경우 주석 해제
    // Cloud Storage 환경 변수 (next.config.mjs에서 직접 설정)
    GOOGLE_CLOUD_PROJECT_ID: 'test-ai-450613',
    GOOGLE_CLOUD_STORAGE_BUCKET: 'video-renderer-storage',
  },
}

export default nextConfig
